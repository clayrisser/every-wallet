/**
 * File: /src/walletProvider.ts
 * Project: every-wallet
 * File Created: 22-03-2022 11:29:28
 * Author: Clay Risser
 * -----
 * Last Modified: 22-03-2022 12:45:50
 * Modified By: Clay Risser
 * -----
 * Risser Labs LLC (c) Copyright 2022
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import WalletConnectProvider from "@walletconnect/web3-provider";
import { CoinbaseWalletSDKOptions } from "@coinbase/wallet-sdk/dist/CoinbaseWalletSDK";
import { IWalletConnectProviderOptions } from "@walletconnect/types/index";
import { ethers } from "ethers";
import CoinbaseWalletSDK, {
  CoinbaseWalletProvider,
} from "@coinbase/wallet-sdk";
import Errors from "./errors";
import modalCss from "./modal.css";
import modalHtml from "./modal.html";

export default class WalletProvider {
  public name: WalletProviderName;

  private options: WalletProviderOptions;

  private walletConnectProvider: WalletConnectProvider;

  private coinbaseProvider: CoinbaseWalletProvider;

  constructor(
    options: Partial<WalletProviderOptions> = {},
    name?: WalletProviderName | null
  ) {
    this.options = {
      ...options,
      appName: "",
      coinbase: {},
      jsonRpcUrl: "",
      network: "mainnet",
      walletConnect: {},
      modal: !options.modal
        ? false
        : typeof options.modal === "string"
        ? options.modal
        : "_modal-id",
    };
    this.options.jsonRpcUrl = WalletProvider.getDefaultJsonRpcUrl(this.options);
    if (name) {
      this.name = name;
    } else {
      this.name = !window.ethereum?.isMetaMask
        ? WalletProviderName.MetaMask
        : WalletProviderName.WalletConnect;
    }
    this.walletConnectProvider = new WalletConnectProvider(
      WalletProvider.getWalletConnectProviderOptions(this.options)
    );
    this.coinbaseProvider = new CoinbaseWalletSDK({
      appName: this.options.appName,
      darkMode: false,
      ...this.options.coinbase,
    }).makeWeb3Provider(this.options.jsonRpcUrl, 1);
    if (this.options.modal) this.injectModal();
  }

  async connect(): Promise<Provider> {
    switch (this.name) {
      case WalletProviderName.Coinbase: {
        return this.connectCoinbase();
      }
      case WalletProviderName.MetaMask: {
        return this.connectMetaMask();
      }
    }
    return this.connectWalletConnect();
  }

  async connectCoinbase() {
    await this.coinbaseProvider.request({ method: "eth_requestAccounts" });
    return new ethers.providers.Web3Provider(this.coinbaseProvider as any);
  }

  async connectMetaMask() {
    if (!window.ethereum?.isMetaMask) {
      throw Errors.MetaMaskNotInstalled;
    }
    if (!window.ethereum.request) {
      throw Errors.WalletConnectionFailed;
    }
    await window.ethereum.request({ method: "eth_requestAccounts" });
    return new ethers.providers.Web3Provider(window.ethereum as any);
  }

  async connectWalletConnect() {
    await this.walletConnectProvider.enable();
    return new ethers.providers.Web3Provider(this.walletConnectProvider);
  }

  private injectModal() {
    const divElement = document.createElement("div");
    divElement.id = this.modalId;
    divElement.innerHTML = modalHtml;
    const styleElement = document.createElement("style");
    styleElement.innerHTML = modalCss;
    divElement.appendChild(styleElement);
    document.body.appendChild(divElement);
    window.onclick = (event) => {
      if (event.target == this.modalElement) this.closeModal();
    };
  }

  async openModal() {
    this.modalElement.style.display = "block";
  }

  async closeModal() {
    this.modalElement.style.display = "none";
  }

  private static getWalletConnectProviderOptions(
    options: WalletProviderOptions
  ) {
    if (options.infuraId) {
      return {
        infuraId: options.infuraId,
        ...options.walletConnect,
      };
    }
    return {
      rpc: {
        0: options.jsonRpcUrl || options.jsonRpcUrl,
        ...(options.walletConnect.rpc || {}),
      },
      ...options.walletConnect,
    };
  }

  private get modalId() {
    return typeof this.options.modal === "string"
      ? this.options.modal
      : "_every-wallet";
  }

  private get modalElement() {
    const modalElement: HTMLDivElement | null = document.querySelector(
      `#${this.modalId} > ._every-wallet-modal`
    );
    if (!modalElement) throw Errors.ModalNotInjected;
    return modalElement;
  }

  private static getDefaultJsonRpcUrl(options: WalletProviderOptions) {
    if (options.infuraId) {
      return `https://${options.network}.infura.io/v3/${options.infuraId}`;
    }
    if (options.network === "mainnet") return "https://cloudflare-eth.com";
    throw Errors.InvalidJsonRpcUrl;
  }
}

export type Provider = ethers.providers.Web3Provider;

export enum WalletProviderName {
  Coinbase = "COINBASE",
  MetaMask = "META_MASK",
  WalletConnect = "WALLET_CONNECT",
}

export interface WalletProviderOptions {
  appName: string;
  coinbase: Partial<CoinbaseWalletSDKOptions>;
  infuraId?: string;
  jsonRpcUrl: string;
  modal: boolean | string;
  network: Network;
  walletConnect: Partial<IWalletConnectProviderOptions>;
}

export type Network = "mainnet" | "ropsten" | "rinkeby" | "kovan";