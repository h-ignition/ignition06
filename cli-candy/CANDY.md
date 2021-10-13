# CANDY MACHINE

All commands need to be run from root folder.
All commands required key and env args (ie: ts-node cli-candy/src/cli.ts COMMAND -k ~/.config/solana/localnet.json -e localnet)
Idl is loaded from ./target/idl/candy_machine.json


1. Verify png / metadata 

```
ts-node cli-candy/src/cli.ts verify_token_metadata cli-candy/example-assets/  -k ~/.config/solana/localnet.json -e localnet
```

2. Upload png

```
ts-node cli-candy/src/cli.ts verify_token_metadata cli-candy/example-assets/  -k ~/.config/solana/localnet.json -e localnet
```

Now you will have a file ./.cache/localnet-temp with arweave link for each png


3. Verify everything is uploaded. Rerun the first command until it is.

```
ts-node cli-candy/src/cli.ts verify  -k ~/.config/solana/localnet.json -e localnet
```

3. Create your candy machine. It can cost up to ~15 solana per 10,000 images.
Here you set the quantity/price for each nft rarity level.
Example: 2 nft available for 1000+ offsets, 8 nft available for 50+ offsets
```
ts-node cli-candy/src/cli.ts create_candy_machine cli-candy/example-assets/ -q 2,8 -p 1000,50  -k ~/.config/solana/localnet.json -e localnet
```
Candy machine address is saved in ./.cache/localnet-temp




7. If you are listed as a creator, run this command to sign your NFTs post sale. This will sign only the latest candy machine that you've created (stored in .cache/candyMachineList.json).

```
metaplex sign_candy_machine_metadata -k ~/.config/solana/id.json
ts-node cli sign_candy_machine_metadata -k ~/.config/solana/id.json
```

8. If you wish to sign metadata from another candy machine run with the --cndy flag.

```
metaplex sign_candy_machine_metadata -k ~/.config/solana/id.json --cndy CANDY_MACHINE_ADDRESS_HERE
ts-node cli sign_candy_machine_metadata -k ~/.config/solana/id.json --cndy CANDY_MACHINE_ADDRESS_HERE
```
