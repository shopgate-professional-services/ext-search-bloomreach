'use strict'
const { promisify } = require('util')
const crypto = require('crypto')

class Client {
  /**
   * @param {Object} config
   * @param {string} endpoint
   */
  constructor ({ config, tracedRequest, log }, endpoint = 'core') {
    this.uri = `http://${config.useStaging ? 'staging-' : ''}${endpoint}.dxpapi.com/api/v1/${endpoint}/`
    this.auth_key = config.auth_key
    this.domain_key = config.domain_key
    this.account_id = config.account_id
    this.url = config.url
    this.ref_url = config.ref_url

    this.tracedRequest = tracedRequest
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
   * @param {Object} params
   *
   * @return {String}
   */
  async request (params) {
    const response = await promisify(this.tracedRequest('Bloomreach'))({
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
      useQuerystring: true,
      json: true
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
      suggestions: response && response.suggestions ? response.suggestions.map(
        result => result.q
      ) : []
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
          response: response,
          request: { params }
        },
        'Doofinder empty results in response'
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
   * @param {String} q
   *
   * @return {Object}
   */
  async getFilters (q) {
    const { facet_counts } = await this.request({ q, rows: 0 }) || {}
    if (!facet_counts) {
      return []
    }

    const { facet_fields, facet_ranges } = facet_counts

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
    if (facet_fields[FACET_CATEGORY] && facet_fields[FACET_CATEGORY].length) {
      facetFieldsToUse.push({
        id: FACET_CATEGORY,
        name: labelsForFacets[FACET_CATEGORY] || FACET_CATEGORY,
        facets: facet_fields[FACET_CATEGORY].map((field) => ({
          count: field.count,
          name: field.cat_name,
          id: field.cat_id
        }))
      })
    }

    // common filters with same structure
    facetWhitelist.forEach((facet) => {
      if (!facet_fields[facet] || !facet_fields[facet].length) {
        return
      }

      facetFieldsToUse.push({
        name: labelsForFacets[facet] || facet,
        facets: facet_fields[facet]
      })
    })

    if (facet_ranges[FACET_PRICE] && facet_ranges[FACET_PRICE].length) {
      facetFieldsToUse.push(
        {
          id: FACET_PRICE,
          name: labelsForFacets[FACET_PRICE] || FACET_PRICE,
          facets: facet_ranges[FACET_PRICE].map((field) => {
            if (field.count <= 0) {
              return
            }

            return {
              count: field.count,
              name: `${field.start}$ - ${field.end}$`
              // id: field.cat_id
            }
          }).filter(Boolean)
        }
      )
    }

    const regEx = new RegExp('\\+', 'g')

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

    console.warn(filters)

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
      nameDesc: 'name desc',
      nameAsc: 'name asc',
      priceDesc: 'sale_price desc',
      priceAsc: 'sale_price asc',
      rankAsc: 'review_rating desc'
    }

    return mapping[sort]
  }
}

module.exports = Client
