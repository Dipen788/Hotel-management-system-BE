require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    ganache: {
      url: "http://127.0.0.1:7545",
      chainId: 1337,
      accounts: [
        "0x39c8d905255a7d4119d4f451664990781f8c197b2f1abce5eda1c2b3be09857e",
        "0xb1c571af0b75ccd69618390d13fde1107bc030fc6f162ce8d5e7a24721e65de1",
        "0xf0f2858511fc3f573a52a196e7af23c86d6504e0a3cf23152701b9b857e62528",
      ],
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};