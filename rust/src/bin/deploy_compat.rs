use ml_dsa_wallet_tools::{
    cast_abi_encode, cast_send_create, cast_wallet_address, chain_id, compile_contracts,
    ensure_0x, flag_value, load_json, save_json, state_dir, string_field, Result,
};
use serde_json::json;
use std::path::PathBuf;

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let rpc_url = flag_value(&args, "--rpc")
        .or_else(|| std::env::var("RPC_URL").ok())
        .ok_or("missing --rpc or RPC_URL")?;
    let private_key = flag_value(&args, "--private-key")
        .or_else(|| std::env::var("PRIVATE_KEY").ok())
        .ok_or("missing --private-key or PRIVATE_KEY")?;
    let key_file = flag_value(&args, "--key-file")
        .map(PathBuf::from)
        .unwrap_or_else(|| state_dir().join("ml_dsa_keypair.json"));
    let out_path = flag_value(&args, "--out")
        .map(PathBuf::from)
        .unwrap_or_else(|| state_dir().join("deployment_compat.json"));
    let payer = flag_value(&args, "--payer")
        .unwrap_or(cast_wallet_address(&private_key)?);
    let token_name = flag_value(&args, "--token-name").unwrap_or_else(|| "PQ Demo Token".to_string());
    let token_symbol = flag_value(&args, "--token-symbol").unwrap_or_else(|| "PQT".to_string());
    let token_decimals = flag_value(&args, "--token-decimals").unwrap_or_else(|| "18".to_string());
    let token_supply =
        flag_value(&args, "--token-supply").unwrap_or_else(|| "1000000000000000000000".to_string());

    let key_data = load_json(&key_file)?;
    let public_key_hex = ensure_0x(string_field(&key_data, "public_key_hex")?);

    let compiled = compile_contracts()?;
    let wallet_bin = compiled
        .get("MLDSAWalletCompat")
        .ok_or("MLDSAWalletCompat bin missing from solc output")?;
    let recipient_bin = compiled
        .get("DemoRecipient")
        .ok_or("DemoRecipient bin missing from solc output")?;
    let token_bin = compiled
        .get("SimpleERC20")
        .ok_or("SimpleERC20 bin missing from solc output")?;

    let wallet_ctor = cast_abi_encode(
        "constructor(bytes,address)",
        &[public_key_hex.clone(), payer.clone()],
    )?;
    let wallet_creation = format!("0x{}{}", wallet_bin, &wallet_ctor[2..]);
    let recipient_creation = format!("0x{}", recipient_bin);
    let wallet_receipt = cast_send_create(&rpc_url, &private_key, &wallet_creation)?;
    let wallet_address = string_field(&wallet_receipt, "contractAddress")?;

    let token_ctor = cast_abi_encode(
        "constructor(string,string,uint8,uint256,address)",
        &[
            token_name.clone(),
            token_symbol.clone(),
            token_decimals.clone(),
            token_supply.clone(),
            wallet_address.to_string(),
        ],
    )?;
    let token_creation = format!("0x{}{}", token_bin, &token_ctor[2..]);

    let recipient_receipt = cast_send_create(&rpc_url, &private_key, &recipient_creation)?;
    let token_receipt = cast_send_create(&rpc_url, &private_key, &token_creation)?;

    let payload = json!({
        "chain_id": chain_id(&rpc_url)?,
        "rpc_url": rpc_url,
        "wallet_type": "compat",
        "wallet_address": wallet_address,
        "wallet_deploy_tx": string_field(&wallet_receipt, "transactionHash")?,
        "demo_recipient_address": string_field(&recipient_receipt, "contractAddress")?,
        "demo_recipient_deploy_tx": string_field(&recipient_receipt, "transactionHash")?,
        "token_address": string_field(&token_receipt, "contractAddress")?,
        "token_deploy_tx": string_field(&token_receipt, "transactionHash")?,
        "token_name": token_name,
        "token_symbol": token_symbol,
        "token_decimals": token_decimals,
        "token_supply": token_supply,
        "payer": payer,
        "public_key_hex": public_key_hex,
    });
    save_json(&out_path, &payload)?;

    println!("MLDSAWalletCompat deployed at {}", string_field(&payload, "wallet_address")?);
    println!(
        "DemoRecipient deployed at {}",
        string_field(&payload, "demo_recipient_address")?
    );
    println!("SimpleERC20 deployed at {}", string_field(&payload, "token_address")?);
    println!("Updated deployment metadata at {}", out_path.display());
    Ok(())
}
