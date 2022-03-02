# Shopgate Connect - Extension Bloomreach Search

[![GitHub license](http://dmlc.github.io/img/apache2.svg)](LICENSE)

Product search implementation using Bloomreach.
This extension will replace the Shopgate default search with the Bloomreach service.
It provides search suggestions, results and result filters from Bloomreach.
It does not provide filters for regular product listings in the catalog.

## Configuration
- `auth_key`: Bloomreach API auth_key
- `domain_key`: Bloomreach API domain_key
- `account_id`: Bloomreach account_id
- `url`: The absolute URL of the page where the request is made.
- `ref_url`: The URL of the HTTP referrer for the webpage where the request is made. You must pass this parameter, but you can send it empty.
- `useSearchSuggestions`: Flag if search suggestions should be used or not
- `useStaging`: Flag if staging endpoint should be used

## Changelog

See [CHANGELOG.md](CHANGELOG.md) file for more information.

## About Shopgate

Shopgate is the leading mobile commerce platform.

Shopgate offers everything online retailers need to be successful in mobile. Our leading
software-as-a-service (SaaS) enables online stores to easily create, maintain and optimize native
apps and mobile websites for the iPhone, iPad, Android smartphones and tablets.

## License

Shopgate Extension Bloomreach Search is available under the Apache License, Version 2.0.

See the [LICENSE](./LICENSE) file for more information.
