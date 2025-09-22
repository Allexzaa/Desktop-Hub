module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Disable CSS minimization to avoid the build error
      const miniCssExtractPlugin = webpackConfig.plugins.find(
        plugin => plugin.constructor.name === 'MiniCssExtractPlugin'
      );
      
      if (miniCssExtractPlugin) {
        miniCssExtractPlugin.options = {
          ...miniCssExtractPlugin.options,
          ignoreOrder: true
        };
      }

      // Find and modify CSS minimizer
      if (webpackConfig.optimization && webpackConfig.optimization.minimizer) {
        webpackConfig.optimization.minimizer = webpackConfig.optimization.minimizer.filter(
          minimizer => minimizer.constructor.name !== 'CssMinimizerPlugin'
        );
      }

      return webpackConfig;
    }
  }
};