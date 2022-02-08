// SPDX-License-Identifier: MIT

pragma solidity 0.8.7;

import "./interfaces/IPancakeRouter.sol";
import "./interfaces/IFarm.sol";

//transfer contract for iteract with PancakeSwap
contract Router {
    address userOwner;
    IPancakeRouter PancakeRouter;
    IFarm pancakeswapFarm;
    IERC20 favor;
    IERC20 cake;
    IERC20 cake_favor_LP_pool;

    constructor (address _userOwner, address _PancakeRouter, address _pancakeswapFarm, address _favor, address _cake, address _cake_favor_LP_pool){
        userOwner = _userOwner;
        PancakeRouter = IPancakeRouter(_PancakeRouter);
        pancakeswapFarm = IFarm(_pancakeswapFarm);
        favor = IERC20(_favor);
        cake = IERC20(_cake);
        cake_favor_LP_pool = IERC20(_cake_favor_LP_pool);
    }

    function _getRewardFromPancakeSwap() private returns (uint){

        uint cake_amount = cake.balanceOf(address(this));

        if(cake_amount != 0){
            address[] memory path = new address[](2);
            path[0] = address(cake);
            path[1] = address(favor);
            
            cake.approve(address(PancakeRouter), cake_amount); 

            uint[] memory balances;
            balances = PancakeRouter.swapExactTokensForTokens(cake_amount, 0, path, address(this), block.timestamp);  
            favor.transfer(userOwner, balances[1]);

            return balances[1];   
            
        }
    } 

    function deposit(uint _poolId, uint _amount) external returns(uint){
        pancakeswapFarm.poolInfo(_poolId).lpToken.approve(address(pancakeswapFarm), _amount);
        pancakeswapFarm.deposit(_poolId, _amount);

        return _getRewardFromPancakeSwap();
    }

    function withdraw(uint _poolId, uint _amount) external returns(uint){
        pancakeswapFarm.withdraw(_poolId, _amount);
        pancakeswapFarm.poolInfo(_poolId).lpToken.transfer(msg.sender, _amount);

        return _getRewardFromPancakeSwap();
    }    

}