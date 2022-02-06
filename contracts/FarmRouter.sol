pragma solidity >=0.8.7;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./Router.sol";

contract FarmRouter {

    using SafeMath for uint;

    function create_router_contract(address MasterFavor, address PancakeRouter, address pancakeswapFarm, address favor, address cake, address cake_favor_LP_pool) public returns (address) {
        
        Router rout;

            rout = new Router(
                MasterFavor,
                PancakeRouter,
                pancakeswapFarm,
                favor,
                cake,
                cake_favor_LP_pool
            );

        return address(rout);
        
    }
}