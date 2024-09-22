/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
  testEnvironment: "jsdom",
  transform: {
    "^.+.tsssx?$": ["ts-jest", {}],
    '^.+\\.ts?$': ['ts-jest', { "compiler": "ttsc" }],
    '^.+\\.(js|jsx)$': [
      'babel-jest', {
          'presets': ['@babel/preset-env'],
          "plugins": [
              ["@babel/plugin-transform-runtime"]
          ]
      }]
  },
  transformIgnorePatterns: ["node_modules\/(?!(lit|lit-element|lit-html|@lit-labs|@lit)\/)"],
};