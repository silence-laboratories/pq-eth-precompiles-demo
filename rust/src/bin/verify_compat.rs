use ml_dsa_wallet_tools::{
    cast_call, cast_rpc, flag_value, load_json, state_dir, string_field, strip_0x, Result,
};
use std::path::PathBuf;

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let rpc_url = flag_value(&args, "--rpc")
        .or_else(|| std::env::var("RPC_URL").ok())
        .ok_or("missing --rpc or RPC_URL")?;
    let deployment_path = flag_value(&args, "--deployment")
        .map(PathBuf::from)
        .unwrap_or_else(|| state_dir().join("deployment_compat.json"));

    let deployment = load_json(&deployment_path)?;
    let wallet = string_field(&deployment, "wallet_address")?;
    let recipient = string_field(&deployment, "demo_recipient_address")?;
    let token = string_field(&deployment, "token_address")?;

    let wallet_code = cast_rpc(&rpc_url, "eth_getCode", Some(&format!("[\"{}\", \"latest\"]", wallet)))?;
    let recipient_code =
        cast_rpc(&rpc_url, "eth_getCode", Some(&format!("[\"{}\", \"latest\"]", recipient)))?;
    let token_code =
        cast_rpc(&rpc_url, "eth_getCode", Some(&format!("[\"{}\", \"latest\"]", token)))?;

    let public_key = cast_call(&rpc_url, wallet, "publicKey()(bytes)", &[])?;
    let nonce = cast_call(&rpc_url, wallet, "nonce()(uint256)", &[])?;
    let payer = cast_call(&rpc_url, wallet, "payer()(address)", &[])?;
    let algorithm = cast_call(&rpc_url, wallet, "algorithm()(uint256)", &[])?;
    let note = cast_call(&rpc_url, recipient, "note()(string)", &[])?;
    let count = cast_call(&rpc_url, recipient, "count()(uint256)", &[])?;
    let token_name = cast_call(&rpc_url, token, "name()(string)", &[])?;
    let token_symbol = cast_call(&rpc_url, token, "symbol()(string)", &[])?;
    let token_decimals = cast_call(&rpc_url, token, "decimals()(uint8)", &[])?;
    let wallet_token_balance =
        cast_call(&rpc_url, token, "balanceOf(address)(uint256)", &[wallet.to_string()])?;

    let wallet_code_hex = string_field(&wallet_code, "result")?;
    let recipient_code_hex = string_field(&recipient_code, "result")?;
    let token_code_hex = string_field(&token_code, "result")?;
    println!("Wallet code size: {} bytes", strip_0x(wallet_code_hex).len() / 2);
    println!(
        "Recipient code size: {} bytes",
        strip_0x(recipient_code_hex).len() / 2
    );
    println!("Token code size: {} bytes", strip_0x(token_code_hex).len() / 2);
    println!("Bound ML-DSA public key length: {} bytes", strip_0x(&public_key).len() / 2);
    println!("Wallet nonce: {}", nonce);
    println!("Wallet payer: {}", payer);
    println!("Wallet algorithm id: {}", algorithm);
    println!("Recipient note: {}", note);
    println!("Recipient count: {}", count);
    println!("Token name: {}", token_name);
    println!("Token symbol: {}", token_symbol);
    println!("Token decimals: {}", token_decimals);
    println!("Wallet token balance: {}", wallet_token_balance);
    Ok(())
}
