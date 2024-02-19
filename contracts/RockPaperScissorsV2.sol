// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./RockPaperScissors.sol";

using SafeERC20 for IERC20;


contract RockPaperScissorsV2 is RockPaperScissors {
    struct PlayerData {
        address address_;
        bytes32 encryptedMove;
        Moves move;
    }

    PlayerData private _playerOne;
    PlayerData private _playerTwo;

    modifier isState(GameState state_) {
        require(state == state_, "Invalid game state");
        _;
    }

    function play(bytes32 encryptedMove) public {
        require(state < GameState.P2MOVED, "Invalid game state");
        if (state == GameState.CREATED) {
            state = GameState.P1MOVED;
            _playerOne.address_ = msg.sender;
            _playerOne.encryptedMove = encryptedMove;
        } else {
            state = GameState.P2MOVED;
            _playerTwo.address_ = msg.sender;
            _playerTwo.encryptedMove = encryptedMove;
        }
        uint256 cost = price * 2;
        erc20.safeTransferFrom(msg.sender, address(this), cost);
    }

    function _verifyMove(Moves move, uint256 secret, bytes32 encryptedMove) internal pure {
        require(move > Moves.UNASSIGNED, "Invalid move");
        bytes32 data = bytes32(secret ^ uint256(move));
        require(keccak256(abi.encodePacked(data)) == encryptedMove, "Secret mismatch");
    }

    function _resolve() internal {
        if (_playerOne.move > Moves.UNASSIGNED && _playerTwo.move > Moves.UNASSIGNED) {
            state = GameState.RESOLVED;
            if (_playerOne.move == _playerTwo.move) {
                erc20.safeTransfer(_playerOne.address_, price);
                erc20.safeTransfer(_playerTwo.address_, price);
            } else {
                if (uint8(_playerOne.move) + 1 == uint8(_playerTwo.move) || 
                    (_playerOne.move == Moves.PAPER && _playerTwo.move == Moves.ROCK)) {
                    erc20.safeTransfer(_playerOne.address_, price * 2);
                } else {
                    erc20.safeTransfer(_playerTwo.address_, price * 2);
                }
            }
        }
    }

    function submitSecret(Moves move, uint256 secret) public isState(GameState.P2MOVED) {
        if (msg.sender == _playerOne.address_) {
            _verifyMove(move, secret, _playerOne.encryptedMove);
            erc20.safeTransfer(_playerOne.address_, price);
            _playerOne.move = move;
            _resolve();
        } else if (msg.sender == _playerTwo.address_) {
            _verifyMove(move, secret, _playerTwo.encryptedMove);
            erc20.safeTransfer(_playerTwo.address_, price);
            _playerTwo.move = move;
            _resolve();
        } else {
            revert("Not allowed");
        }
    }
}
