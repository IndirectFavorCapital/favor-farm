pragma solidity 0.8.7;

interface IRouter {
    function deposit(uint _poolId, uint _amount) external returns(uint);
    function withdraw(uint _poolId, uint _amount) external returns(uint);
}