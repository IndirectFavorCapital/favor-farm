// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

//Interfeace for interact with pancakeswap farm smart contract
interface IFarm {
    struct PoolInfo {
        IERC20 lpToken;           // Address of LP token contract.
        uint256 allocPoint;       // How many allocation points assigned to this pool. Favors to distribute per block.
        uint256 lastRewardBlock;  // Last block number that Favors distribution occurs.
        uint256 accFavorPerShare; // Accumulated Favors per share, times 1e12. See below.
    }

    function enterStaking(uint256 _amount) external;
    function poolLength() external view returns (uint256);

    function poolInfo(uint _index) external view returns(PoolInfo memory);
    function leaveStaking(uint256 _amount) external;

    function pendingCake(uint256 _pid, address _user) external view returns (uint256);
    
    function deposit(uint256 _pid, uint256 _amount) external;
    function withdraw(uint256 _pid, uint256 _amount) external;
}
