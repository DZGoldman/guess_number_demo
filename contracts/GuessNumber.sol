pragma solidity ^0.4.23;
pragma experimental ABIEncoderV2;

contract GuessNumber {
  enum ActionType {
      GUESS, CLUE, REVEAL
  }
  struct Action{
    uint8 guess;
    bool clue;
    string secret;
    ActionType actionType;
    address sender;
  }
  
    address public disputer;
    uint256 timeoutInterval;
    
  
  struct GameState {
      address whoseTurn;
      address guesser;
      address dealer;
      bool[5] clues;
      uint8[5] guesses;
      bytes32 secretHash;
      bool gameStarted;
      uint stake;
      uint seq;
      address winner;
      address contractAddress;
  }
  GameState public onChainState;

  event AcceptGame(GameState gameState);
  event StartDispute(GameState gameState, address starter);
  event EndDispute(GameState gameState);
  event UpdateTimeout(uint256 newTimeout, address whoseTurn);



  constructor(bytes32 _secretHash) public payable {
    require(msg.value > 0);
    uint8[5] tempGuesses;
    bool[5]  tempClues;
      
    onChainState = GameState({
        whoseTurn: msg.sender,
        guesser: address(0),
        dealer: msg.sender,
        clues:tempClues,
        guesses: tempGuesses,
        secretHash: _secretHash,
        gameStarted: false,
        stake: msg.value,
        seq: 0,
        winner: address(0),
        contractAddress: address(this)

    });
        timeoutInterval = 3600;
        timeout =  2**256 - 1;
  }
  
    
//   during a dispate: making a move directly ends it happily
// jumping to a DIFFERNT later or = state leads to slashing
// starting a dispute means jumping to state (and possibly aslo moving), or just moving

  function applyActionToChainState(Action action) public payout updateTimeout {
    //   ensure sender is the real sender:(require it instead of overwriting? whatever)
    action.sender = msg.sender;
    onChainState = applyAction(onChainState, action);
    if (disputer == opponentOf (onChainState, msg.sender)){
        endDispute();
    } else if (disputer == address(0)){
        startDispute();
    }
  }

//   TODO is this safe, i.e, private should be impossible to call directly?
  function startDispute() private  {
       disputer = msg.sender;
       emit StartDispute(getOnChainState(), msg.sender);
  }

    function endDispute() private  {
       disputer = address(0);
       emit EndDispute(onChainState);
  }

  
  function getOnChainState() public view returns(GameState){
      return onChainState;
  }

  function stateToFullDigest(GameState gameState) public pure returns (bytes32){
        bytes32 inputAppHash = stateToHash(gameState);
        // TODO: purify address this
        return prefixed(keccak256(gameState.contractAddress, inputAppHash));
  }

//   Might not need this?
   function stateToHash(GameState gameState) public pure returns (bytes32){
        return keccak256(abi.encode(gameState));
  }

  function jumpToStateOnChain(GameState gameState, bytes sig, Action action) public payout updateTimeout returns (bool){
    bytes32 inputStateHash = stateToFullDigest(gameState);
    require(recoverSigner(inputStateHash, sig) == opponentOf(gameState, msg.sender));
    
    // happy case: players agreed on winner, stop here
    if (gameState.winner != address(0) ){
        return true;
    }
    
    require(gameState.seq >= onChainState.seq);
    // for dispute, but may as well always check: don't jump to redundant state (player could have honestly applied action)
    require(stateToFullDigest(onChainState) != stateToFullDigest(gameState));


    
    if (disputer == address(0)){
        onChainState = gameState;
        // if initiating a dispute at current turn, have to make a move in same transaction (if not, or if this is settling a dispute, action can be a dummy action)
        if (onChainState.whoseTurn == msg.sender){
            applyActionToChainState(action);
        }
        startDispute();
    } else if (disputer == opponentOf(gameState, msg.sender)){
        onChainState.winner = msg.sender;
    }
 
    return true;
  }
  
      modifier updateTimeout (){
        timeout = now + timeoutInterval;
        emit UpdateTimeout(timeout, onChainState.whoseTurn);
        _;
    }
    
    function claimTimeout() payout payable{
        require(onChainState.winner == address(0));
        require(onChainState.whoseTurn == opponentOf(onChainState, msg.sender));
        require(now > timeout);
        onChainState.winner = msg.sender;
    }

    function test(string s) returns(bytes32){
        return keccak256(s);
    }

    function testGetClues() public returns (bool[5]){
        return onChainState.clues;
    }
    
       function stringToUint(string s) constant returns (uint result) {
        bytes memory b = bytes(s);
        uint i;
        result = 0;
        for (i = 0; i < b.length; i++) {
            uint c = uint(b[i]);
            if (c >= 48 && c <= 57) {
                result = result * 10 + (c - 48);
            }
        }
    }

  modifier payout() {
      _;
      if(onChainState.winner!= address(0)) {
          onChainState.winner.transfer(address(this).balance);
          onChainState.gameStarted = false;
      }
  }
  
  
    function acceptGame() public payable updateTimeout {
      require(msg.value >= onChainState.stake);
      require(!onChainState.gameStarted);
      onChainState.gameStarted = true;
      onChainState.whoseTurn = msg.sender;
      onChainState.guesser = msg.sender;
      emit AcceptGame(getOnChainState());
  }
  
    function applyAction(GameState gameState, Action action)public view turnTaker(gameState, action.sender) returns(GameState){
      if(action.actionType == ActionType.GUESS){
          return submitGuess(gameState, action);
      } else if (action.actionType == ActionType.CLUE){
          return submitClue(gameState, action);
      } else if (action.actionType == ActionType.REVEAL){
          return reveal(gameState, action);
      }

  }
  
  function submitGuess( GameState gameState, Action action) pure public returns  (GameState){
        require(action.guess < 100);
        require(action.guess > 0);
        gameState.guesses[gameState.seq/2] = action.guess;
        return gameState;
  }
    function submitClue( GameState gameState, Action action) pure public returns  (GameState){
        // todo: divide by 2 7 round down
        require(gameState.seq < 10);
        gameState.clues[gameState.seq/2] = action.clue;
        return gameState;
  }
  
  function reveal(GameState gameState, Action action) returns (GameState){
    //   why do I have this?
    //   require(msg.sender == gameState.dealer);
      if (keccak256(action.secret) != gameState.secretHash ){
          gameState.winner = opponentOf(gameState, action.sender);
     
      } else {
             //   getnumber
          uint winningNumber = stringToUint(action.secret) % 100;
          uint8 currentGuess;
          bool currentClue;
          for (uint i=0; i<gameState.guesses.length; i++) {
              
            currentGuess = gameState.guesses[i];
            currentClue = gameState.clues[i];
            
            if (currentGuess == winningNumber || currentGuess==0){
                gameState.winner = gameState.guesser;
                return gameState;
            }
    
            
            if ( (currentGuess < winningNumber && currentClue) ||(currentGuess > winningNumber && !currentClue) ) {
                gameState.winner = gameState.guesser;
                return gameState;
            }
          }
        // TODO edgecase for if he doesn't submit last clue ? meh
        // if gueser didn't make all of his guesses yet, guesser wins (check for zeros? requrie this up front)
        // otherwise, dealer wins,
      }
           return gameState;
  }
    
    function opponentOf(GameState gameState, address player)public pure returns(address){
        if (player == gameState.dealer){
            return gameState.guesser;
        } else if (player== gameState.guesser){
            return gameState.dealer;
        }
        require(false);
    }
    

      
  
  modifier turnTaker(GameState gameState, address sender) {
      require(gameState.winner == address(0));
      require(sender == gameState.whoseTurn);
      require(gameState.gameStarted);
      gameState.seq++;
      gameState.whoseTurn = opponentOf(gameState, sender);
      _;    
  }
  
      // Signature methods

    function splitSignature(bytes sig)
        internal
        pure
        returns (uint8, bytes32, bytes32)
    {
        require(sig.length == 65);

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            // first 32 bytes, after the length prefix
            r := mload(add(sig, 32))
            // second 32 bytes
            s := mload(add(sig, 64))
            // final byte (first byte of the next 32 bytes)
            v := byte(0, mload(add(sig, 96)))
        }

        return (v, r, s);
    }

    function recoverSigner(bytes32 message, bytes sig)
        internal
        pure
        returns (address)
    {
        uint8 v;
        bytes32 r;
        bytes32 s;

        (v, r, s) = splitSignature(sig);

        return ecrecover(message, v, r, s);
    }

    // Builds a prefixed hash to mimic the behavior of eth_sign.
    function prefixed(bytes32 hash) internal pure returns (bytes32) {
        return keccak256("\x19Ethereum Signed Message:\n32", hash);
    }

 
}
