import React, { Component } from "react";
import SimpleStorageContract from "./contracts/SimpleStorage.json";
import GuessNumberContract from "./contracts/GuessNumber.json";
import getWeb3 from "./utils/getWeb3";
import truffleContract from "truffle-contract";
import axios from "axios";
import openSocket from 'socket.io-client';
import "./App.css";
import { ethers, utils } from 'ethers';
import GuessNumberApp from './GuessNumberApp'




const domain = "http://0.0.0.0:33507"
window.utils = utils
const pkey = "2FBF00F19A0379C6F81AA7190DF6AE28D4260C278DB5FBE44CE0C0895B865446"
const tkey2 = "756BC8C44936D9CC1B48398B23ABD9DA6D706FB77509EDA2F4BAE5B8BD67A600"
  // ganache-cli -m "matter tobacco now banana panel impulse fun renew recall obscure leaf remember"

class App extends Component {
  state = { wallet: null, storageValue: 0, web3: null, accounts: null, contract: null, einstance: null, socket:null };

  sendMessage = async (msg) => {
    this.state.socket.emit('message', {sender: this.state.accounts[0], data: msg})
    window.setInterval(()=>{
      // console.log('pinging...')
  }, 1000)


  }
  
  componentDidMount = async () => {
    // this.dataUrl = "/data";
    // if (process.env.NODE_ENV == "development") {
    //   this.dataUrl = "http://0.0.0.0:33507" + this.dataUrl;
    // };

    // axios.get(this.dataUrl).then(d => {
    //   console.log('dtatatdsdfsdata',d)
    // }).catch(function (error) {
    //   console.log('')
    //   console.log(error);
    // });
    const socket = openSocket(domain);


    // socket.emit('message', socket.id)
  
    window.c = this

    try {
      // Get network provider and web3 instance.
      const web3 = await getWeb3();
      window.wev3 = web3;
      // Use web3 to get the user's accounts.
      const accounts = await web3.eth.getAccounts();
      let provider = await new ethers.providers.Web3Provider(web3.currentProvider);
      let a = await provider.listAccounts()
      // Get the contract instance.

      // console.log(window.web3.sha3 ( "394857" )); 
      var wallet, signingKey;
      if (accounts[0] == "0xAEFeC101B51cf5f1A4e12Db9cce8901c63497784"){

        wallet = new ethers.Wallet(pkey, provider)
        signingKey =new ethers.utils.SigningKey(pkey);
      } else {
        wallet = new ethers.Wallet(tkey2, provider)
        signingKey =new ethers.utils.SigningKey(tkey2);
      }
      const Contract = truffleContract(SimpleStorageContract);
      Contract.setProvider(web3.currentProvider);
      const instance = await Contract.deployed();
      const einstance =  new ethers.Contract(instance.address, SimpleStorageContract.abi, wallet);

      const GuessContract = truffleContract(GuessNumberContract);
      GuessContract.setProvider(web3.currentProvider);
      const guessInstance = await GuessContract.deployed();
      const guessEthInstance =  new ethers.Contract(guessInstance.address, GuessNumberContract.abi, wallet);


      const evalue = await einstance.get()
      console.log('?????????', evalue.toNumber())

      // Set web3, accounts, and contract to the state, and then proceed with an
      // example of interacting with the contract's methods.
      const value = await instance.get()



      this.setState({signingKey, guessContract:guessEthInstance, wallet, web3, accounts, contract: instance, storageValue:value.toNumber(), einstance,socket  });

      socket.on('connect', (r, e) => {
        this.setState({socket_id: socket.id, socket})
        console.log('Websocket connected!', socket.id)
        socket.emit('message', accounts[0])
    });

  //   socket.on('message_data', (res)=>{
  //     if (res.sender!= this.state.accounts[0]){

  //       console.log('RECEIVED A PONG', res)
  //     }
  // });

    } catch (error) {
      console.log(error);
    }
  };

  runExample = async () => {
    console.log("TEST SETTING DATA:")
    const { accounts, contract, web3, einstance } = this.state;

    var response = await einstance.get();
    await einstance.set(response.toNumber() +1);
    response = await einstance.get();

    this.setState({ storageValue: response.toNumber() });
  };

  giveStr = async ()=>{
    const { accounts, contract, web3, einstance } = this.state;

    var b = await einstance.giveStr()
    console.log(b)
    window.str = b
  }
  getAction = async ()=>{
    const { accounts, contract, web3, einstance } = this.state;

    var b = await einstance.getAction()
    console.log(b)
  }

  modifyBoolArray = async () => {
    const { accounts, contract, web3, einstance } = this.state;

    var b = await einstance.modifyBoolArray()
    console.log(b)
  }
  

  render() {
    if (!this.state.web3) {
      return <div>Loading Web3, accounts, and contract...</div>;
    }
    return (
      <div className="App">
        <h1 onClick = {this.runExample}>Good to Go!</h1>
        <h2>{this.state.accounts[0]}</h2>
        <div>The stored value is: {this.state.storageValue}</div>
        <GuessNumberApp
          sendMessage ={this.sendMessage}
          wallet={this.state.wallet}
          guessContract={this.state.guessContract}
          socket={this.state.socket}
          accounts={this.state.accounts}
          signingKey={this.state.signingKey}
        />
      </div>
    );
  }
}

export default App;
