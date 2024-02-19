// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";


contract RockPaperScissors is Initializable {
    enum GameState{ CREATED, P1MOVED, P2MOVED, RESOLVED }
    enum Moves{ UNASSIGNED, ROCK, SCISSORS, PAPER }

    GameState public state;
    IERC20 public erc20;
    uint256 public price;


    function initialize(
        address erc20_,
        uint256 price_
    ) public initializer {
        state = GameState.CREATED;
        erc20 = IERC20(erc20_);
        price = price_;
    }
}
