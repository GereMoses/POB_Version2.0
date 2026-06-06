/**
 * Create React App Configuration Override
 * Optimizes build for production deployment
 */

const { override, addWebpackPlugin } = require('customize-cra');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const CompressionPlugin = require('compression-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

module.exports = override(
  // Bundle analyzer for production builds
  (config, env) => {
    if (env === 'production') {
      if (process.env.ANALYZE === 'true') {
        config.plugins.push(
          new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            openAnalyzer: false,
            reportFilename: 'bundle-report.html',
          })
        );
      }
    }
    return config;
  },

  // Production optimizations
  (config, env) => {
    if (env === 'production') {
      // Add compression plugin
      config.plugins.push(
        new CompressionPlugin({
          algorithm: 'gzip',
          test: /\.(js|css|html|svg)$/,
          threshold: 8192,
          minRatio: 0.8,
        })
      );

      // Optimize Terser configuration
      config.optimization.minimizer.push(
        new TerserPlugin({
          terserOptions: {
            compress: {
              drop_console: true,
              drop_debugger: true,
              pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.warn'],
            },
            mangle: {
              safari10: true,
            },
            format: {
              comments: false,
            },
          },
          extractComments: false,
        })
      );

      // Optimize CSS
      const MiniCssExtractPlugin = config.plugins.find(
        plugin => plugin.constructor.name === 'MiniCssExtractPlugin'
      );
      if (MiniCssExtractPlugin) {
        MiniCssExtractPlugin.options.ignoreOrder = true;
      }

      // Optimize images
      config.module.rules.find(rule => rule.oneOf).oneOf.forEach(rule => {
        if (rule.test && rule.test.toString().includes('image')) {
          rule.use = [
            {
              loader: 'url-loader',
              options: {
                limit: 8192,
                name: 'static/media/[name].[hash].[ext]',
              },
            },
            {
              loader: 'image-webpack-loader',
              options: {
                mozjpeg: {
                  progressive: true,
                  quality: 85,
                },
                webp: {
                  quality: 90,
                },
                pngquant: {
                  quality: [0.65, 0.90],
                  speed: 4,
                },
                gifsicle: {
                  interlaced: false,
                  optimizationLevel: 3,
                },
              },
            },
          ];
        }
      });
    }

    return config;
  },

  // Development optimizations
  (config, env) => {
    if (env === 'development') {
      // Enable faster source maps
      config.devtool = 'eval-cheap-module-source-map';

      // Optimize webpack performance
      config.cache = true;

      // Reduce bundle size in development
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
            },
          },
        },
      };
    }

    return config;
  },

  // Add Webpack performance optimizations
  (config) => {
    // Enable webpack performance hints
    config.performance = {
      hints: process.env.NODE_ENV === 'production' ? 'warning' : false,
      maxEntrypointSize: 512000,
      maxAssetSize: 512000,
    };

    // Optimize chunk splitting
    config.optimization = {
      ...config.optimization,
      splitChunks: {
        chunks: 'all',
        minSize: 20000,
        maxSize: 244000,
        minChunks: 1,
        maxAsyncRequests: 30,
        maxInitialRequests: 30,
        automaticNameDelimiter: '~',
        cacheGroups: {
          vendors: {
            test: /[\\/]node_modules[\\/]/,
            priority: -10,
            reuseExistingChunk: true,
          },
          antd: {
            test: /[\\/]node_modules[\\/]antd[\\/]/,
            name: 'antd',
            priority: 20,
            chunks: 'all',
          },
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            name: 'react',
            priority: 30,
            chunks: 'all',
          },
          common: {
            minChunks: 2,
            priority: 5,
            reuseExistingChunk: true,
          },
        },
      },
      runtimeChunk: {
        name: 'runtime',
      },
    };

    return config;
  },

  // Add support for environment-specific configurations
  (config) => {
    // Define environment variables
    if (!config.plugins) {
      config.plugins = [];
    }
    config.plugins.push(
      new config.webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
        'process.env.REACT_APP_API_URL': JSON.stringify(process.env.REACT_APP_API_URL),
        'process.env.REACT_APP_ENVIRONMENT': JSON.stringify(process.env.REACT_APP_ENVIRONMENT),
        'process.env.PUBLIC_URL': JSON.stringify(process.env.PUBLIC_URL),
      })
    );

    return config;
  }
);
