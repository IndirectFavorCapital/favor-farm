pragma solidity 0.8.7;

interface IFarmRouter{
    function create_router_contract(address MasterFavor, address PancakeRouter, address pancakeswapFarm, address favor, address cake, address cake_favor_LP_pool) external returns (address) ;
}
