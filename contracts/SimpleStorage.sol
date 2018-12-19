pragma solidity ^0.4.23;
pragma experimental ABIEncoderV2;

contract SimpleStorage {
  struct Action{
    string actionType;
    bool[3] arrayTest;
    bool[20] arrayTest2;
    uint8[3] arrayTest3;
    string[3] arrayTest4;
       bool[20] arrayTest5;
          bool[20] arrayTest6;
             bool[20] arrayTest7;
                bool[20] arrayTest8;
                   bool[20] arrayTest9;
                      bool[20] arrayTest10;
  }
  uint storedData;
  Action action;
  bool[10] boolArray;
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
  }

  
  constructor(){
    action = Action({
      actionType: "hellow world",
      arrayTest: [true, false, true],
      arrayTest2: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false ],
      arrayTest3: [1,2,3],
      arrayTest4: ['a', 'b', 'd'],
      arrayTest5: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false ],
      arrayTest6: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false ],
      arrayTest7: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false ],
      arrayTest8: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false ],
      arrayTest9: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false ],
      arrayTest10: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false ]


    });
    
  }
  function set(uint x) public {
    storedData = x;
  }

  function get() public view returns (uint) {
    return storedData;
  }

  function getAction() public view returns (Action a){
    return action;
  }

  function giveAction(Action a) public view returns (string atype){
    return a.actionType;
  }

  function giveStr() public returns (string z){
    return action.actionType;
  }

  function modifyBoolArray() public{
    action.arrayTest[0] = !action.arrayTest[0];
  }
}
