'use strict'
const crypto = require('crypto')
const request = require('request-promise-native')

class Client {
  /**
   * @param {{ config, log }} options
   * @param {string} endpoint
   */
  constructor ({ config, log }, endpoint = 'core') {
    this.uri = `http://${config.useStaging ? 'staging-' : ''}${endpoint}.dxpapi.com/api/v1/${endpoint}/`
    this.auth_key = config.auth_key
    this.domain_key = config.domain_key
    this.account_id = config.account_id
    this.url = config.url
    this.ref_url = config.ref_url

    this.log = log
  }

  /**
   * @param {Object} responseItem
   * @returns {*}
   */
  getProductId (responseItem) {
    if (typeof this.productIdKey !== 'string') {
      try {
        return this.productIdKey.evalSync(responseItem)
      } catch (err) {
        this.log.error({ err }, 'Bloomreach product id is not found')
        return null
      }
    }
    return responseItem[this.productIdKey]
  }

  /**
   * @param {{ [key: string]: number|string|string[] }} params
   *
   * @return {Promise<object>}
   */
  async request (params) {
    const response = await request({
      uri: this.uri,
      qs: {
        account_id: this.account_id,
        auth_key: this.auth_key,
        domain_key: this.domain_key,
        ref_url: this.ref_url,
        url: this.url,
        request_id: crypto.randomBytes(12).toString('hex'),
        _br_uid_2: 'n/a',
        fl: 'pid, ProductCode',
        rows: 10,
        start: 0,
        request_type: 'search',
        search_type: 'keyword',
        ...params
      },
      useQuerystring: true, // serialize arrays as foo=bar&foo=baz instead of the default foo[0]=bar&foo[1]=baz
      json: true,
      resolveWithFullResponse: true
    })

    if (response.statusCode >= 400) {
      this.log.error(
        {
          body: response.body,
          request: params
        },
        `Bloomreach error code ${response.statusCode} in response`
      )
    }

    return response.body
  }

  /**
   * @param {String} q
   *
   * @returns {Object}
   */
  async getSearchSuggestions (q) {
    const response = await this.request({
      q: q.slice(0, 88),
      search_type: undefined,
      request_type: 'suggest'
    })

    return {
      suggestions: response && response.suggestions
        ? response.suggestions.map(
          result => result.q
        )
        : []
    }
  }

  /**
   * @param {Object} input
   * @return {Object}
   */
  async searchProducts ({ searchPhrase, filters, offset = 0, limit = 10, sort }) {
    const params = {
      q: searchPhrase,
      fq: this.prepareFilters(filters),
      start: offset,
      rows: limit,
      sort: this.prepareSort(sort),
      request_type: 'search',
      search_type: 'keyword',
      boost: 'coupon:true' // show coupons always on top
    }

    const { response, keywordRedirect = {} } = await this.request(params) || {}

    if (!response || !Array.isArray(response.docs)) {
      this.log.error(
        {
          response,
          request: { params }
        },
        'Bloomreach empty results in response'
      )
      return {
        productIds: [],
        totalProductCount: 0
      }
    }

    return {
      productIds: response.docs.map(({ ProductCode }) => ProductCode.toString()),
      totalProductCount: response.numFound,
      redirectedUrl: keywordRedirect['redirected url'] || null
    }
  }

  /**
   * @param {string} q
   *
   * @return {Object}
   */
  async getFilters (q) {
    const params = { q, rows: 0, 'facet.field': ['category', 'sale_price'] }
    const { facet_counts: facetCounts } = await this.request(params) || {}
    if (!facetCounts) {
      return []
    }

    const { facets } = facetCounts

    const facetWhitelist = [
      // 'category', need special treatment because data is different
      'brand',
      'More Ways To Shop'
    ]
    const FACET_CATEGORY = 'category'
    const FACET_PRICE = 'sale_price'
    const labelsForFacets = {
      brand: 'Brand',
      [FACET_CATEGORY]: 'Category',
      [FACET_PRICE]: 'Sale Price'
    }

    const facetFieldsToUse = []

    // special treatment for category facet since it has different data
    const categoryFacet = facets.find(facet => facet.name === 'category')
    if (categoryFacet && categoryFacet.value.length) {
      facetFieldsToUse.push({
        id: FACET_CATEGORY,
        name: labelsForFacets[FACET_CATEGORY] || FACET_CATEGORY,
        facets: categoryFacet.value.map((field) => {
          if (field.cat_name.includes('~')) return null

          return {
            count: field.count,
            name: field.cat_name,
            id: field.cat_id
          }
        }).filter(Boolean)
      })
    }

    // common filters with same structure
    facetWhitelist.forEach((facetName) => {
      const field = facets.find(facet => facet.name === facetName)
      if (!field || !field.value.length) {
        return
      }

      facetFieldsToUse.push({
        name: labelsForFacets[facetName] || facetName,
        facets: field.value
      })
    })

    const salePriceFacet = facets.find(f => f.name === 'sale_price')
    if (salePriceFacet && salePriceFacet.value.length) {
      facetFieldsToUse.push(
        {
          id: FACET_PRICE,
          name: labelsForFacets[FACET_PRICE] || FACET_PRICE,
          facets: salePriceFacet.value.map((field) => {
            if (field.count <= 0) {
              return undefined
            }

            let name = field.name

            if (field.start === '*') {
              name = `Below $${field.end}`
            } else if (field.end === '*') {
              name = `$${field.start} And Up`
            } else if ((field.start || field.start === 0) && field.end) {
              name = `$${field.start} - $${Math.ceil(field.end)}`
            }

            return {
              count: field.count,
              name,
              id: `[${field.start} TO ${field.end}]`
            }
          }).filter(Boolean)
        }
      )
    }

    const regEx = /\+/g

    const filters = facetFieldsToUse.map(({ id, name, facets }) => {
      return {
        id: id || name,
        label: name,
        source: 'Bloomreach',
        type: 'multiselect',
        values: facets.map(element => ({
          id: element.id || element.name,
          label: `${decodeURIComponent(element.name.replace(regEx, ' '))} (${element.count})`,
          hits: element.count
        }))
      }
    })

    return { filters }
  }

  /**
   * @param {Object} filters
   *
   * @return {Object}
   */
  prepareFilters (filters = {}) {
    // const params = new URLSearchParams();
    return Object.keys(filters).map((filter) => {
      // &fq=color: "red" OR "purple"
      const values = filters[filter].values.map((val) => `"${val}"`)
      return `${filter}: ${values.join(' OR ')}`
      // params.append('fq', `${id}: ${values.join(' OR ')}`);
    })
  }

  /**
   * @param {String} sort
   *
   * @return {Object}
   */
  prepareSort (sort) {
    const mapping = {
      nameDesc: 'title desc',
      nameAsc: 'title asc',
      priceDesc: 'sale_price desc',
      priceAsc: 'sale_price asc',
      rankAsc: 'review_rating desc'
    }

    return mapping[sort]
  }
}

module.exports = Client
