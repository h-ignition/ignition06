#!/usr/bin/env ts-node
import * as fs from 'fs';
import * as path from 'path';
import { program } from 'commander';
import * as anchor from '@project-serum/anchor';
import BN from 'bn.js';
import fetch from 'node-fetch';
import log from 'loglevel';
import { PublicKey } from '@solana/web3.js';

import { fromUTF8Array, parsePrice } from './helpers/various';
import {
  CACHE_PATH,
  CONFIG_ARRAY_START,
  CONFIG_LINE_SIZE,
  EXTENSION_JSON,
  EXTENSION_PNG,
} from './helpers/constants';
import { upload } from './commands/upload';
import {
  getCandyMachineAddress,
  loadCandyProgram,
  loadWalletKey,
} from './helpers/accounts';
import { Config } from './types';
import { verifyTokenMetadata } from './commands/verifyTokenMetadata';
import { loadCache, saveCache } from './helpers/cache';
import { signMetadata } from './commands/sign';
import { signAllMetadataFromCandyMachine } from './commands/signAll';

program.version('0.0.2');

if (!fs.existsSync(CACHE_PATH)) {
  fs.mkdirSync(CACHE_PATH);
}

log.setLevel(log.levels.INFO);

programCommand('upload')
  .argument(
    '<directory>',
    'Directory containing images named from 0-n',
    val => {
      return fs.readdirSync(`${val}`).map(file => path.join(val, file));
    },
  )
  .option('-n, --number <number>', 'Number of images to upload')
  .option('--no-retain-authority', 'Do not retain authority to update metadata')
  .action(async (files: string[], options, cmd) => {
    const {
      number,
      keypair,
      env,
      cacheName,
    } = cmd.opts();

    const pngFileCount = files.filter(it => {
      return it.endsWith(EXTENSION_PNG);
    }).length;
    const jsonFileCount = files.filter(it => {
      return it.endsWith(EXTENSION_JSON);
    }).length;

    const parsedNumber = parseInt(number);
    const elemCount = parsedNumber ? parsedNumber : pngFileCount;

    if (pngFileCount !== jsonFileCount) {
      throw new Error(
        `number of png files (${pngFileCount}) is different than the number of json files (${jsonFileCount})`,
      );
    }

    if (elemCount < pngFileCount) {
      throw new Error(
        `max number (${elemCount})cannot be smaller than the number of elements in the source folder (${pngFileCount})`,
      );
    }

    log.info(`Beginning the upload for ${elemCount} (png+json) pairs`);

    const startMs = Date.now();
    log.info('started at: ' + startMs.toString());
    let warn = false;
    for (; ;) {
      const successful = await upload(
        files,
        cacheName,
        env,
        keypair,
        elemCount,
      );

      if (successful) {
        warn = false;
        break;
      } else {
        warn = true;
        log.warn('upload was not successful, rerunning');
      }
    }
    const endMs = Date.now();
    const timeTaken = new Date(endMs - startMs).toISOString().substr(11, 8);
    log.info(
      `ended at: ${new Date(endMs).toISOString()}. time taken: ${timeTaken}`,
    );
    if (warn) {
      log.info('not all images have been uploaded, rerun this step.');
    }
  });

programCommand('verify_token_metadata')
  .argument(
    '<directory>',
    'Directory containing images and metadata files named from 0-n',
    val => {
      return fs
        .readdirSync(`${val}`)
        .map(file => path.join(process.cwd(), val, file));
    },
  )
  .option('-n, --number <number>', 'Number of images to upload')
  .action((files: string[], options, cmd) => {
    const { number } = cmd.opts();

    const startMs = Date.now();
    log.info('started at: ' + startMs.toString());
    verifyTokenMetadata({ files, uploadElementsCount: number });

    const endMs = Date.now();
    const timeTaken = new Date(endMs - startMs).toISOString().substr(11, 8);
    log.info(
      `ended at: ${new Date(endMs).toString()}. time taken: ${timeTaken}`,
    );
  });

programCommand('verify').action(async (directory, cmd) => {
  const { env, keypair, cacheName } = cmd.opts();

  const cacheContent = loadCache(cacheName, env);
  const walletKeyPair = loadWalletKey(keypair);
  const anchorProgram = await loadCandyProgram(walletKeyPair, env);

  const configAddress = new PublicKey(cacheContent.program.config);
  const config = await anchorProgram.provider.connection.getAccountInfo(
    configAddress,
  );
  let allGood = true;

  const keys = Object.keys(cacheContent.items);
  for (let i = 0; i < keys.length; i++) {
    log.debug('Looking at key ', i);
    const key = keys[i];
    const thisSlice = config.data.slice(
      CONFIG_ARRAY_START + 4 + CONFIG_LINE_SIZE * i,
      CONFIG_ARRAY_START + 4 + CONFIG_LINE_SIZE * (i + 1),
    );
    const name = fromUTF8Array([...thisSlice.slice(4, 36)]);
    const uri = fromUTF8Array([...thisSlice.slice(40, 240)]);
    const cacheItem = cacheContent.items[key];
    if (!name.match(cacheItem.name) || !uri.match(cacheItem.link)) {
      cacheItem.onChain = false;
      allGood = false;
    } else {
      const json = await fetch(cacheItem.link);
      if (json.status == 200 || json.status == 204 || json.status == 202) {
        const body = await json.text();
        const parsed = JSON.parse(body);
        if (parsed.image) {
          const check = await fetch(parsed.image);
          if (
            check.status == 200 ||
            check.status == 204 ||
            check.status == 202
          ) {
            const text = await check.text();
            if (!text.match(/Not found/i)) {
              if (text.length == 0) {
                log.info(
                  'Name',
                  name,
                  'with',
                  uri,
                  'has zero length, failing',
                );
                cacheItem.onChain = false;
                allGood = false;
              } else {
                log.info('Name', name, 'with', uri, 'checked out');
              }
            } else {
              log.info(
                'Name',
                name,
                'with',
                uri,
                'never got uploaded to arweave, failing',
              );
              cacheItem.onChain = false;
              allGood = false;
            }
          } else {
            log.info(
              'Name',
              name,
              'with',
              uri,
              'returned non-200 from uploader',
              check.status,
            );
            cacheItem.onChain = false;
            allGood = false;
          }
        } else {
          log.info('Name', name, 'with', uri, 'lacked image in json, failing');
          cacheItem.onChain = false;
          allGood = false;
        }
      } else {
        log.info('Name', name, 'with', uri, 'returned no json from link');
        cacheItem.onChain = false;
        allGood = false;
      }
    }
  }

  if (!allGood) {
    saveCache(cacheName, env, cacheContent);

    throw new Error(
      `not all NFTs checked out. check out logs above for details`,
    );
  }

  const configData = (await anchorProgram.account.config.fetch(
    configAddress,
  )) as Config;

  const lineCount = new BN(config.data.slice(247, 247 + 4), undefined, 'le');

  log.info(
    `uploaded (${lineCount.toNumber()}) out of (${configData.data.maxNumberOfLines
    })`,
  );
  if (configData.data.maxNumberOfLines > lineCount.toNumber()) {
    throw new Error(
      `predefined number of NFTs (${configData.data.maxNumberOfLines
      }) is smaller than the uploaded one (${lineCount.toNumber()})`,
    );
  } else {
    log.info('ready to deploy!');
  }

  saveCache(cacheName, env, cacheContent);
});

programCommand('verify_price')
  .option('-p, --price <string>')
  .option('--cache-path <string>')
  .action(async (directory, cmd) => {
    const { keypair, env, price, cacheName, cachePath } = cmd.opts();
    const lamports = parsePrice(price);

    if (isNaN(lamports)) {
      return log.error(`verify_price requires a --price to be set`);
    }

    log.info(`Expected price is: ${lamports}`);

    const cacheContent = loadCache(cacheName, env, cachePath);

    if (!cacheContent) {
      return log.error(
        `No cache found, can't continue. Make sure you are in the correct directory where the assets are located or use the --cache-path option.`,
      );
    }

    const walletKeyPair = loadWalletKey(keypair);
    const anchorProgram = await loadCandyProgram(walletKeyPair, env);

    const candyAddress = new PublicKey(cacheContent.candyMachineAddress);

    const machine = await anchorProgram.account.candyMachine.fetch(
      candyAddress,
    );

    //@ts-ignore
    const candyMachineLamports = machine.data.price.toNumber();

    log.info(`Candymachine price is: ${candyMachineLamports}`);

    if (lamports != candyMachineLamports) {
      throw new Error(`Expected price and CandyMachine's price do not match!`);
    }

    log.info(`Good to go!`);
  });

programCommand('show')
  .option('--cache-path <string>')
  .action(async (directory, cmd) => {
    const { keypair, env, cacheName, cachePath } = cmd.opts();

    const cacheContent = loadCache(cacheName, env, cachePath);

    if (!cacheContent) {
      return log.error(
        `No cache found, can't continue. Make sure you are in the correct directory where the assets are located or use the --cache-path option.`,
      );
    }

    const walletKeyPair = loadWalletKey(keypair);
    const anchorProgram = await loadCandyProgram(walletKeyPair, env);

    const [candyMachine] = await getCandyMachineAddress(
      new PublicKey(cacheContent.program.config),
      cacheContent.program.uuid,
    );

    try {
      const machine = await anchorProgram.account.candyMachine.fetch(
        candyMachine,
      );
      log.info('...Candy Machine...');
      log.info('Key:', candyMachine.toBase58());
      //@ts-ignore
      log.info('authority: ', machine.authority.toBase58());
      //@ts-ignore
      log.info('wallet: ', machine.wallet.toBase58());
      //@ts-ignore
      log.info(
        'tokenMint: ',
        //@ts-ignore
        machine.tokenMint ? machine.tokenMint.toBase58() : null,
      );
      //@ts-ignore
      log.info('config: ', machine.config.toBase58());
      //@ts-ignore
      log.info('uuid: ', machine.data.uuid);
      //@ts-ignore
      log.info('price: ', machine.data.price.toNumber());
      //@ts-ignore
      log.info('itemsAvailable: ', machine.data.itemsAvailable.toNumber());
      log.info(
        'goLiveDate: ',
        //@ts-ignore
        machine.data.goLiveDate
          ? //@ts-ignore
          new Date(machine.data.goLiveDate * 1000)
          : 'N/A',
      );
    } catch (e) {
      console.log('No machine found');
    }

    const config = await anchorProgram.account.config.fetch(
      cacheContent.program.config,
    );
    log.info('...Config...');
    //@ts-ignore
    log.info('authority: ', config.authority.toBase58());
    //@ts-ignore
    log.info('symbol: ', config.data.symbol);
    log.info('sellerFeeBasisPoints: ', config.data.sellerFeeBasisPoints);
    //@ts-ignore
    log.info('creators: ');
    //@ts-ignore
    config.data.creators.map(c =>
      log.info(c.address.toBase58(), 'at', c.share, '%'),
    ),
      //@ts-ignore
      log.info('maxSupply: ', config.data.maxSupply.toNumber());
    //@ts-ignore
    log.info('retainAuthority: ', config.data.retainAuthority);
    //@ts-ignore
    log.info('maxNumberOfLines: ', config.data.maxNumberOfLines);
  });

programCommand('create_candy_machine')
  .argument(
    '<directory>',
    'Directory containing images and metadata files named from 0-n',
    val => {
      return fs
        .readdirSync(`${val}`)
        .map(file => path.join(process.cwd(), val, file));
    },
  )
  .option(
    '-q, --quantity <string>',
    'NFT quantity available at each level (levels ordered from top to less rare)',
    '0',
  )
  .option(
    '-p, --price <string>',
    'Min price for each level (levels ordered from top to less rare).',
    '0'
  )
  .action(async (files: string[], directory, cmd) => {
    const {
      keypair,
      env,
      cacheName,
      quantity,
      price,
    } = cmd.opts();

    let totalQuantity = 0;
    let quantities: Array<number> = [];
    let qtt = (quantity as string).split(",");
    qtt.forEach((q) => {
      let v = parseInt(q);
      totalQuantity += v;
      quantities.push(v);
    });

    let prices: Array<number> = [];
    let p = (price as string).split(",");
    p.forEach((q) => {
      prices.push(parseFloat(q));
    });

    const pngFileCount = files.filter(it => {
      return it.endsWith(EXTENSION_PNG);
    }).length;
    const jsonFileCount = files.filter(it => {
      return it.endsWith(EXTENSION_JSON);
    }).length;

    if (pngFileCount != jsonFileCount || pngFileCount != totalQuantity) {
      throw Error("Quantities does not match " + pngFileCount + "/" + jsonFileCount + "/" + totalQuantity);
    }

    if (quantities.length != prices.length) {
      throw Error("No price set for each level");
    }

    let price0 = prices[0];
    for (let i = 1; i < prices.length; i++) {
      let p = prices[i];
      if (p >= price0) {
        throw Error("Levels must be ordered from top to bottom");
      }
      price0 = p;
    }

    let itemsByLevel: Array<{ itemsAvailable: anchor.BN, price: anchor.BN }> = [];
    for (let i = 0; i < prices.length; i++) {
      itemsByLevel.push({
        itemsAvailable: new anchor.BN(quantities[i]),
        price: new anchor.BN(prices[i]),
      })
    };

    const cacheContent = loadCache(cacheName, env);
    const walletKeyPair = loadWalletKey(keypair);
    const anchorProgram = await loadCandyProgram(walletKeyPair, env);

    let wallet = walletKeyPair.publicKey;

    const config = new PublicKey(cacheContent.program.config);
    const [candyMachine, bump] = await getCandyMachineAddress(
      config,
      cacheContent.program.uuid,
    );
    await anchorProgram.rpc.initializeCandyMachine(
      bump,
      {
        uuid: cacheContent.program.uuid,
        itemsByLevel: itemsByLevel,
        goLiveDate: new anchor.BN(1),
      },
      {
        accounts: {
          candyMachine,
          wallet,
          config: config,
          authority: walletKeyPair.publicKey,
          payer: walletKeyPair.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        signers: [],
      },
    );
    cacheContent.candyMachineAddress = candyMachine.toBase58();
    saveCache(cacheName, env, cacheContent);
    log.info(
      `create_candy_machine finished. candy machine pubkey: ${candyMachine.toBase58()}`,
    );

  });

// programCommand('update_candy_machine')
//   .option(
//     '-d, --date <string>',
//     'timestamp - eg "04 Dec 1995 00:12:00 GMT" or "now"',
//   )
//   .option('-p, --price <string>', 'SOL price')
//   .action(async (directory, cmd) => {
//     const { keypair, env, date, price, cacheName } = cmd.opts();
//     const cacheContent = loadCache(cacheName, env);

//     const secondsSinceEpoch = date ? parseDate(date) : null;
//     const lamports = price ? parsePrice(price) : null;

//     const walletKeyPair = loadWalletKey(keypair);
//     const anchorProgram = await loadCandyProgram(walletKeyPair, env);

//     const candyMachine = new PublicKey(cacheContent.candyMachineAddress);
//     const tx = await anchorProgram.rpc.updateCandyMachine(
//       lamports ? new anchor.BN(lamports) : null,
//       secondsSinceEpoch ? new anchor.BN(secondsSinceEpoch) : null,
//       {
//         accounts: {
//           candyMachine,
//           authority: walletKeyPair.publicKey,
//         },
//       },
//     );

//     cacheContent.startDate = secondsSinceEpoch;
//     saveCache(cacheName, env, cacheContent);
//     if (date)
//       log.info(
//         ` - updated startDate timestamp: ${secondsSinceEpoch} (${date})`,
//       );
//     if (lamports)
//       log.info(` - updated price: ${lamports} lamports (${price} SOL)`);
//     log.info('update_candy_machine finished', tx);
//   });


programCommand('sign')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  .option('-m, --metadata <string>', 'base58 metadata account id')
  .action(async (directory, cmd) => {
    const { keypair, env, metadata } = cmd.opts();

    await signMetadata(metadata, keypair, env);
  });

programCommand('sign_all')
  .option('-b, --batch-size <string>', 'Batch size', '10')
  .option('-d, --daemon', 'Run signing continuously', false)
  .action(async (directory, cmd) => {
    const { keypair, env, cacheName, batchSize, daemon } = cmd.opts();
    const cacheContent = loadCache(cacheName, env);
    const walletKeyPair = loadWalletKey(keypair);
    const anchorProgram = await loadCandyProgram(walletKeyPair, env);
    const candyAddress = cacheContent.candyMachineAddress;

    const batchSizeParsed = parseInt(batchSize);
    if (!parseInt(batchSize)) {
      throw new Error('Batch size needs to be an integer!');
    }

    log.debug('Creator pubkey: ', walletKeyPair.publicKey.toBase58());
    log.debug('Environment: ', env);
    log.debug('Candy machine address: ', candyAddress);
    log.debug('Batch Size: ', batchSizeParsed);
    await signAllMetadataFromCandyMachine(
      anchorProgram.provider.connection,
      walletKeyPair,
      candyAddress,
      batchSizeParsed,
      daemon,
    );
  });

function programCommand(name: string) {
  return program
    .command(name)
    .option(
      '-e, --env <string>',
      'Solana cluster env name',
      'localnet', //mainnet-beta, testnet, devnet
    )
    .option(
      '-k, --keypair <path>',
      `Solana wallet location`,
      '--keypair not provided',
    )
    .option('-l, --log-level <string>', 'log level', setLogLevel)
    .option('-c, --cache-name <string>', 'Cache file name', 'temp');
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function setLogLevel(value, prev) {
  if (value === undefined || value === null) {
    return;
  }
  log.info('setting the log value to: ' + value);
  log.setLevel(value);
}

program.parse(process.argv);
