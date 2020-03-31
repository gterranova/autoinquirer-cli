const path = require('path');
const TerserPlugin = require('terser-webpack-plugin')

module.exports = {
  entry: {
    autoinquirer: './src/index.ts',
  },
  target: 'node',
  module: {
    rules: [{
      test: /\.tsx?$/,
      use: 'ts-loader',
      // exclude: /node_modules/
      include: __dirname
    }]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  output: {
    filename: '[name].js',
    library: 'autoinquirer',
    libraryTarget: 'commonjs2',
    path: path.resolve(__dirname, 'dist')
  },
  plugins: [
    //new DtsBundlePlugin(), 
    new TerserPlugin({
      parallel: true,
      terserOptions: {
        ecma: 6,
      },
    }),
  ]
};
/*
function DtsBundlePlugin(){}
DtsBundlePlugin.prototype.apply = function (compiler) {
  compiler.plugin('done', function(){
    var dts = require('dts-bundle');

    var libs = {
        autoinquirer: './src/index.ts'
    };

    Object.keys(libs).map( libName => {
        dts.bundle({
            name: libName,
            main: path.resolve(__dirname, 'build', `${libs[libName].replace(/\.ts$/, '.d.ts')}`),
            out: path.resolve(__dirname, 'dist', `${libName}.d.ts`),
            //removeSource: true,
            outputAsModuleFolder: true // to use npm in-package typings
          });      
    });
  });
};*/