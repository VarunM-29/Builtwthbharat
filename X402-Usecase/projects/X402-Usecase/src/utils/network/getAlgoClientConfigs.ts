import { AlgoViteClientConfig, AlgoViteKMDConfig } from '../../interfaces/network'

export function getAlgodConfigFromViteEnvironment(): AlgoViteClientConfig {
  return {
    server: import.meta.env.VITE_ALGOD_SERVER || 'https://testnet-api.algonode.cloud',
    port: import.meta.env.VITE_ALGOD_PORT || '443',
    token: import.meta.env.VITE_ALGOD_TOKEN || '',
    network: import.meta.env.VITE_ALGOD_NETWORK || 'testnet',
  }
}

export function getIndexerConfigFromViteEnvironment(): AlgoViteClientConfig {
  return {
    server: import.meta.env.VITE_INDEXER_SERVER || 'https://testnet-idx.algonode.cloud',
    port: import.meta.env.VITE_INDEXER_PORT || '443',
    token: import.meta.env.VITE_INDEXER_TOKEN || '',
    network: import.meta.env.VITE_ALGOD_NETWORK || 'testnet',
  }
}

export function getKmdConfigFromViteEnvironment(): AlgoViteKMDConfig {
  return {
    server: import.meta.env.VITE_KMD_SERVER || 'http://localhost',
    port: import.meta.env.VITE_KMD_PORT || '4002',
    token: import.meta.env.VITE_KMD_TOKEN || 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    wallet: import.meta.env.VITE_KMD_WALLET || 'unencrypted-default-wallet',
    password: import.meta.env.VITE_KMD_PASSWORD || '',
  }
}
