// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

contract MLDSAWalletCompat {
    uint256 public constant PUBLIC_KEY_LENGTH = 1312;
    uint256 public constant algorithm = 1; // Dilithium / ML-DSA direct
    address public constant ML_DSA_VERIFY_PRECOMPILE = address(0x1b);

    error InvalidPublicKeyLength(uint256 provided);
    error InvalidPayer(address provided);
    error UnauthorizedPayer(address caller, address expectedPayer);
    error SignatureVerificationCallFailed();
    error InvalidSignature();
    error Expired(uint256 currentTimestamp, uint256 deadline);
    error CallFailed(bytes revertData);

    bytes public publicKey;
    address public payer;
    uint256 public nonce;

    constructor(bytes memory publicKey_, address payer_) {
        if (publicKey_.length != PUBLIC_KEY_LENGTH) {
            revert InvalidPublicKeyLength(publicKey_.length);
        }
        if (payer_ == address(0)) {
            revert InvalidPayer(payer_);
        }

        publicKey = publicKey_;
        payer = payer_;
    }

    receive() external payable {}

    function operationDigest(
        address target,
        uint256 value,
        bytes calldata data,
        uint256 deadline,
        uint256 nonce_
    ) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                block.chainid,
                address(this),
                nonce_,
                target,
                value,
                keccak256(data),
                deadline
            )
        );
    }

    function execute(
        address target,
        uint256 value,
        bytes calldata data,
        uint256 deadline,
        bytes calldata signature
    ) external payable returns (bytes memory result) {
        if (msg.sender != payer) {
            revert UnauthorizedPayer(msg.sender, payer);
        }
        if (block.timestamp > deadline) {
            revert Expired(block.timestamp, deadline);
        }

        uint256 usedNonce = nonce;
        bytes32 digest = operationDigest(target, value, data, deadline, usedNonce);
        bytes memory verifyInput =
            abi.encodePacked(publicKey, signature, bytes2(0x0000), digest);

        (bool ok, bytes memory verifyOutput) = ML_DSA_VERIFY_PRECOMPILE.staticcall(verifyInput);
        if (!ok) {
            revert SignatureVerificationCallFailed();
        }
        if (verifyOutput.length != 32 || verifyOutput[31] != 0x01) {
            revert InvalidSignature();
        }

        nonce = usedNonce + 1;

        (ok, result) = target.call{value: value}(data);
        if (!ok) {
            revert CallFailed(result);
        }
    }
}
