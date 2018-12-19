import React, { Component } from "react";
import "./App.css";
import { ethers, utils } from "ethers";

window.utils = utils;
window.ethers = ethers;

class GuessNumApp extends Component {
  state = {
    gameState: {},
    stateAwaitingResponse: null,
    currentStateDigest: null,
    latestOpponentSignature: null
  };
  componentDidMount = async () => {
    
    this.props.socket.on("message_data", this.handleIncomingMessage);
    this.setOnChainEvents();
    // if (window.localStorage.state){
    //     this.setState(JSON.parse(window.localStorage.state))
    // }
  };

  setGameStateReact = async (gameState, withDigest) => {
    var newState = {gameState}
    if (withDigest == true){
        var newDigest = await this.props.guessContract.stateToFullDigest(gameState )
        console.log('NEWDIGEST', newDigest)
        newState = Object.assign (newState, {currentStateDigest:  newDigest});
    } else if (withDigest){
        newState = Object.assign (newState, {currentStateDigest: withDigest});

    }
    this.setState(newState);
  };

  applyActionToChainState = async action => {
    const  actionObj =       this.getActionObject(action);
    await this.props.guessContract.applyActionToChainState(
        actionObj
    );
  };

//   componentDidUpdate = async (prevProps, prevState) => {
//       window.localStorage.state = {...this.state}
//   }
  

  sendOpponentOffChainTxn = async action => {
    // 1) use current state to apply action off chain and get new state
    // serialize new state and sign it
    this.applyActionOffChain(action, async newState => {
      const newStateDigest = await this.props.guessContract.stateToFullDigest(
        newState
      );
      console.log(newStateDigest);
      let signature = this.props.signingKey.signDigest(newStateDigest);
      console.log(signature);
      this.setState({ stateAwaitingResponse: { ...newState } }, () => {
        // TODO this order may be bad, ensure message is sent first, etc (but then what if response is too fast?)
        this.props.sendMessage({
          type: "offChainTxnRequest",
          newStateDigest,
          signature,
          action
        });
      });
    });
  };

  // overWriteSenderWithSelf = (action)=>{
  //     return Object.assign({}, action, {sender: this.props.accounts[0]})
  // }

  receiveOffChainTxn = async msg => {
    // test out action with current (react)
    const { guessContract, accounts } = this.props;
    const opponent = await guessContract.opponentOf(
      this.state.gameState,
      accounts[0]
    );
    // ensure no error?
    // console.log(opponent)

    // app opponent and try out action
    const newAction = Object.assign({}, msg.action, { sender: opponent });
    this.applyActionOffChain(newAction, async newState => {
      // check new state matces given state:
      const newStateDigest = await guessContract.stateToFullDigest(newState);
      if (newStateDigest != msg.newStateDigest) {
        // todo: send error message?

        return false;
      }

      // verify signature
      let recovered = utils.recoverAddress(newStateDigest, msg.signature);
      if (recovered != opponent) {
        return false;
      }

      console.log("RECEIVER SUCCESS! TXN IS VALID ", newStateDigest);

      this.setState({
        gameState: newState,
        currentStateDigest: newStateDigest,
        latestOpponentSignature: msg.signature
      });
      // sign it
      const signature = this.props.signingKey.signDigest(newStateDigest);

      this.props.sendMessage({
        type: "offChainTxnResponse",
        newStateDigest,
        signature
      });
    });
  };

  receiveOffChainTxnResponse = async msg => {
    // sanity: ensure awaiting a response
    if (!this.state.stateAwaitingResponse) {
      console.warn("received a response at an unexpected time...?");
    }
    const opponent = await this.props.guessContract.opponentOf(
      this.state.gameState,
      this.props.accounts[0]
    );

    // ensure digest is what you think it is
    const digestCheck = await this.props.guessContract.stateToFullDigest(
      this.state.stateAwaitingResponse
    );
    if (msg.newStateDigest != digestCheck) {
      console.warn("digest check fail", msg.stateDigest, digestCheck);
      return false;
    }

    let recovered = utils.recoverAddress(msg.newStateDigest, msg.signature);
    if (recovered != opponent) {
      return false;
    }
    this.setState({
      gameState: this.state.stateAwaitingResponse,
      stateAwaitingResponse: null,
      currentStateDigest: digestCheck,
      latestOpponentSignature: msg.signature
    });
    console.log("SENDER SUCCESS! Cycle COMPLETE UPDATING STATE");
    // otherwise, consider it finalized
  };
  applyActionOffChain = async (action, then) => {
    const currentState = this.state.gameState;
    const newState = await this.props.guessContract.applyAction(
      currentState,
      this.getActionObject(action)
    );
    if (then) {
      then(newState);
    }
    return newState;
  };

  getActionObject = (act={}) => {
    // defaults
   
    const action = {
      guess: 0,
      actionType: 0,
      clue: false,
      secret: "",
      sender: this.props.accounts[0]
    };

    const actionObj = Object.assign({}, action, act);
    console.log("actionObj", actionObj);
    return actionObj;
  };

  setOnChainEvents = async () => {

    this.props.guessContract.on("*", data => {
      console.log("*** On Chain Event Event ***", data.event, "****");
      console.log(data)
      switch (data.event) {
        case "AcceptGame":
          //
          this.fetchAndSetState(true);
          break;
        case "StartDispute":
          this.handleStartDispute(data);
          break;
        case "EndDispute":
            
          break;
        case "UpdateTimeout":
          break;

        default:
          break;
      }
    });
  };

  jumpToLatestState = async  ()=>{
      this.props.guessContract.jumpToStateOnChain(
          this.state.gameState,
          utils.joinSignature(this.state.latestOpponentSignature),
          this.getActionObject()
      )
  }

  handleStartDispute = async data => {
    //   TODO cleaner oppent getting, I mean cmon
    const {starter} = data.args;
    this.getOnChainState( async (gameState)=> {
        if (starter == this.props.accounts[0]) {
            return this.fetchAndSetState();
        }
        // TODO: convert to number?
        if(gameState.seq > this.state.gameState.seq){
            console.warn("this shouldnt happen");
            return this.fetchAndSetState();
        } 
        const disputeStateDigest = await this.props.guessContract.stateToFullDigest( gameState);
        // TODO: gamestate is coming back as an array, not object, from events
        if ( ((gameState.seq == this.state.gameState.seq) && (disputeStateDigest != this.state.currentStateDigest) ) || (gameState.seq < this.state.gameState.seq)) {
           console.log('SSLASHING!!!!');
        //    TODO: finish this
            this.jumpToLatestState();
        } else {
            console.log('updating to the current State given', gameState.seq, this.state.gameState.seq)
            return this.fetchAndSetState(true);
        } 

    })


  };

  handleIncomingMessage = async msg => {
    if (msg.sender == this.props.accounts[0]) {
      return false;
    }
    console.log("MESSAGE RECEIVED!!!!", msg);
    switch (msg.data.type) {
      case "offChainTxnRequest":
        this.receiveOffChainTxn(msg.data);
        break;
      case "offChainTxnResponse":
        this.receiveOffChainTxnResponse(msg.data);
        break;
    }
  };
  getOnChainState = async then => {
    const state = await this.props.guessContract.getOnChainState();
    console.log("????", state);
    if (then) {
      then(state);
    }
  };

  getOnChainStateTest = then => {
    const state = this.props.guessContract.getOnChainState
      .call()
      .then((d, s, a) => {
        console.log(d, s, a);
      });
    console.log("ptherreturn??", state);
  };

  fetchAndSetState = async (withDigest) => {
    this.getOnChainState(gameState => {
      this.setGameStateReact(gameState, withDigest)
    });
  };

  sendMessage = async msg => {
    this.props.sendMessage(msg);
  };
  acceptGame = async () => {
    console.log("from", this.props.accounts[0]);
    const state = await this.props.guessContract.acceptGame({ value: 50000 });
  };

  getTimeout = async () => {
    const timeout = await this.props.guessContract.timeout();
    console.log(timeout.toNumber());
  };

  render() {
    return (
      <div className="App">
        guess number
        <div>state digest:{this.state.currentStateDigest} </div>
        <div>#:{JSON.stringify(this.state.gameState.seq && this.state.gameState.seq.toNumber())}</div>
        <div>Wei {Math.max(this.state.appState.nonce, 0)}</div>
      </div>
    );
  }
}

export default GuessNumApp;

// const ethers = require('ethers');

// let privateKey = '0x0123456789012345678901234567890123456789012345678901234567890123';
// let signingKey = new ethers.utils.SigningKey(privateKey);

// console.log('Address: ' + signingKey.address);
// // "Address: 0x14791697260E4c9A71f18484C9f997B308e59325"

// let message = "Hello World";
// let messageBytes = ethers.utils.toUtf8Bytes(message);
// let messageDigest = ethers.utils.keccak256(messageBytes);

// console.log("Digest: " + messageDigest);
// // "Digest: 0x592fa743889fc7f92ac2a37bb1f5ba1daf2a5c84741ca0e0061d243a2e6707ba"

// let signature = signingKey.signDigest(messageDigest);

// console.log(signature);
// // {
// //    recoveryParam: 0,
// //    r: "0x79f56f3422dc67f57b2aeeb0b20295a99ec90420b203177f83d419c98beda7fe",
// //    s: "0x1a9d05433883bdc7e6d882740f4ea7921ef458a61b2cfe6197c2bb1bc47236fd"
// // }

// let recovered = ethers.utils.recoverAddress(messageDigest, signature);

// console.log("Recovered: " + recovered);
// // "Recovered: 0x14791697260E4c9A71f18484C9f997B308e59325"

// let publicKey = signingKey.publicKey;

// console.log('Public Key: ' + publicKey);
// // "Public Key: 0x026655feed4d214c261e0a6b554395596f1f1476a77d999560e5a8df9b8a1a3515"

// let compressedPublicKey = ethers.utlis.computePublicKey(publicKey, true);
// let uncompressedPublicKey = ethers.utils.computePublicKey(publicKey, false);

// console.log(compressedPublicKey);
// // "0x026655feed4d214c261e0a6b554395596f1f1476a77d999560e5a8df9b8a1a3515"

// console.log(uncompressedPublicKey);
// // "0x046655feed4d214c261e0a6b554395596f1f1476a77d999560e5a8df9b8a1a35" +
// //   "15217e88dd05e938efdd71b2cce322bf01da96cd42087b236e8f5043157a9c068e"

// let address = ethers.utils.computeAddress(publicKey);

// console.log('Address: ' + address);
// // "Address: 0x14791697260E4c9A71f18484C9f997B308e59325"
