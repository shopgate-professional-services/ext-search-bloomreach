const BloomreachClient = require('./bloomreach/Client')

/**
 * @param {PipelineContext} context
 * @param {Object} input
 * @returns {Promise<Object>}
 */
module.exports = async (context, input) => {
  return new BloomreachClient(context).searchProducts(input)
}
