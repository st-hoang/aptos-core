/* eslint-disable no-bitwise */
import { AxiosResponse } from 'axios';
import { AptosClient, raiseForStatus } from './aptos_client';
import { AnyObject } from './util';

import { FAUCET_URL, NODE_URL } from './util.test';
import { FaucetClient } from './faucet_client';
import { AptosAccount } from './aptos_account';
import { TxnBuilderTypes, TransactionBuilderMultiEd25519, BCS, TransactionBuilder } from './transaction_builder';
import { TokenClient } from './token_client';

test('gets genesis account', async () => {
  const client = new AptosClient(NODE_URL);
  const account = await client.getAccount('0x1');
  expect(account.authentication_key.length).toBe(66);
  expect(account.sequence_number).not.toBeNull();
});

test('gets transactions', async () => {
  const client = new AptosClient(NODE_URL);
  const transactions = await client.getTransactions();
  expect(transactions.length).toBeGreaterThan(0);
});

test('gets genesis resources', async () => {
  const client = new AptosClient(NODE_URL);
  const resources = await client.getAccountResources('0x1');
  const accountResource = resources.find((r) => r.type === '0x1::Account::Account');
  expect((accountResource.data as AnyObject).self_address).toBe('0x1');
});

test('gets the Account resource', async () => {
  const client = new AptosClient(NODE_URL);
  const accountResource = await client.getAccountResource('0x1', '0x1::Account::Account');
  expect((accountResource.data as AnyObject).self_address).toBe('0x1');
});

test('gets ledger info', async () => {
  const client = new AptosClient(NODE_URL);
  const ledgerInfo = await client.getLedgerInfo();
  expect(ledgerInfo.chain_id).toBeGreaterThan(1);
  expect(parseInt(ledgerInfo.ledger_version, 10)).toBeGreaterThan(0);
});

test('gets account modules', async () => {
  const client = new AptosClient(NODE_URL);
  const modules = await client.getAccountModules('0x1');
  const module = modules.find((r) => r.abi.name === 'TestCoin');
  expect(module.abi.address).toBe('0x1');
});

test('gets the TestCoin module', async () => {
  const client = new AptosClient(NODE_URL);
  const module = await client.getAccountModule('0x1', 'TestCoin');
  expect(module.abi.address).toBe('0x1');
});

test('test raiseForStatus', async () => {
  const testData = { hello: 'wow' };
  const fakeResponse: AxiosResponse = {
    status: 200,
    statusText: 'Status Text',
    data: 'some string',
    request: {
      host: 'host',
      path: '/path',
    },
  } as AxiosResponse;

  // Shouldn't throw
  raiseForStatus(200, fakeResponse, testData);
  raiseForStatus(200, fakeResponse);

  // an error, oh no!
  fakeResponse.status = 500;
  expect(() => raiseForStatus(200, fakeResponse, testData)).toThrow(
    'Status Text - "some string" @ host/path : {"hello":"wow"}',
  );

  expect(() => raiseForStatus(200, fakeResponse)).toThrow('Status Text - "some string" @ host/path');

  // Just a wild test to make sure it doesn't break: request is `any`!
  delete fakeResponse.request;
  expect(() => raiseForStatus(200, fakeResponse, testData)).toThrow('Status Text - "some string" : {"hello":"wow"}');

  expect(() => raiseForStatus(200, fakeResponse)).toThrow('Status Text - "some string"');
});

test(
  'submits bcs transaction',
  async () => {
    const client = new AptosClient(NODE_URL);
    const faucetClient = new FaucetClient(NODE_URL, FAUCET_URL, null);

    const account1 = new AptosAccount();
    await faucetClient.fundAccount(account1.address(), 5000);
    let resources = await client.getAccountResources(account1.address());
    let accountResource = resources.find((r) => r.type === '0x1::Coin::CoinStore<0x1::TestCoin::TestCoin>');
    expect((accountResource.data as any).coin.value).toBe('5000');

    const account2 = new AptosAccount();
    await faucetClient.fundAccount(account2.address(), 0);
    resources = await client.getAccountResources(account2.address());
    accountResource = resources.find((r) => r.type === '0x1::Coin::CoinStore<0x1::TestCoin::TestCoin>');
    expect((accountResource.data as any).coin.value).toBe('0');

    const token = new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString('0x1::TestCoin::TestCoin'));

    const scriptFunctionPayload = new TxnBuilderTypes.TransactionPayloadScriptFunction(
      TxnBuilderTypes.ScriptFunction.natual(
        '0x1::Coin',
        'transfer',
        [token],
        [BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(account2.address())), BCS.bcsSerializeUint64(717)],
      ),
    );

    const [{ sequence_number: sequnceNumber }, chainId] = await Promise.all([
      client.getAccount(account1.address()),
      client.getChainId(),
    ]);

    const rawTxn = new TxnBuilderTypes.RawTransaction(
      TxnBuilderTypes.AccountAddress.fromHex(account1.address()),
      BigInt(sequnceNumber),
      scriptFunctionPayload,
      1000n,
      1n,
      BigInt(Math.floor(Date.now() / 1000) + 10),
      new TxnBuilderTypes.ChainId(chainId),
    );

    const bcsTxn = AptosClient.generateBCSTransaction(account1, rawTxn);
    const transactionRes = await client.submitSignedBCSTransaction(bcsTxn);

    await client.waitForTransaction(transactionRes.hash);

    resources = await client.getAccountResources(account2.address());
    accountResource = resources.find((r) => r.type === '0x1::Coin::CoinStore<0x1::TestCoin::TestCoin>');
    expect((accountResource.data as any).coin.value).toBe('717');
  },
  30 * 1000,
);

test(
  'submits multisig transaction',
  async () => {
    const client = new AptosClient(NODE_URL);
    const faucetClient = new FaucetClient(NODE_URL, FAUCET_URL, null);

    const account1 = new AptosAccount();
    const account2 = new AptosAccount();
    const account3 = new AptosAccount();
    const multiSigPublicKey = new TxnBuilderTypes.MultiEd25519PublicKey(
      [
        new TxnBuilderTypes.Ed25519PublicKey(account1.signingKey.publicKey),
        new TxnBuilderTypes.Ed25519PublicKey(account2.signingKey.publicKey),
        new TxnBuilderTypes.Ed25519PublicKey(account3.signingKey.publicKey),
      ],
      2,
    );

    const authKey = TxnBuilderTypes.AuthenticationKey.fromMultiEd25519PublicKey(multiSigPublicKey);

    const mutisigAccountAddress = authKey.derivedAddress();
    await faucetClient.fundAccount(mutisigAccountAddress, 5000);

    let resources = await client.getAccountResources(mutisigAccountAddress);
    let accountResource = resources.find((r) => r.type === '0x1::Coin::CoinStore<0x1::TestCoin::TestCoin>');
    expect((accountResource.data as any).coin.value).toBe('5000');

    const account4 = new AptosAccount();
    await faucetClient.fundAccount(account4.address(), 0);
    resources = await client.getAccountResources(account4.address());
    accountResource = resources.find((r) => r.type === '0x1::Coin::CoinStore<0x1::TestCoin::TestCoin>');
    expect((accountResource.data as any).coin.value).toBe('0');

    const token = new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString('0x1::TestCoin::TestCoin'));

    const scriptFunctionPayload = new TxnBuilderTypes.TransactionPayloadScriptFunction(
      TxnBuilderTypes.ScriptFunction.natual(
        '0x1::Coin',
        'transfer',
        [token],
        [BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(account4.address())), BCS.bcsSerializeUint64(123)],
      ),
    );

    const [{ sequence_number: sequnceNumber }, chainId] = await Promise.all([
      client.getAccount(mutisigAccountAddress),
      client.getChainId(),
    ]);

    const rawTxn = new TxnBuilderTypes.RawTransaction(
      TxnBuilderTypes.AccountAddress.fromHex(mutisigAccountAddress),
      BigInt(sequnceNumber),
      scriptFunctionPayload,
      1000n,
      1n,
      BigInt(Math.floor(Date.now() / 1000) + 10),
      new TxnBuilderTypes.ChainId(chainId),
    );

    const txnBuilder = new TransactionBuilderMultiEd25519((signingMessage: TxnBuilderTypes.SigningMessage) => {
      const sigHexStr1 = account1.signBuffer(signingMessage);
      const sigHexStr3 = account3.signBuffer(signingMessage);
      const bitmap = TxnBuilderTypes.MultiEd25519Signature.createBitmap([0, 2]);

      const muliEd25519Sig = new TxnBuilderTypes.MultiEd25519Signature(
        [
          new TxnBuilderTypes.Ed25519Signature(sigHexStr1.toUint8Array()),
          new TxnBuilderTypes.Ed25519Signature(sigHexStr3.toUint8Array()),
        ],
        bitmap,
      );

      return muliEd25519Sig;
    }, multiSigPublicKey);

    const bcsTxn = txnBuilder.sign(rawTxn);
    const transactionRes = await client.submitSignedBCSTransaction(bcsTxn);

    await client.waitForTransaction(transactionRes.hash);

    resources = await client.getAccountResources(account4.address());
    accountResource = resources.find((r) => r.type === '0x1::Coin::CoinStore<0x1::TestCoin::TestCoin>');
    expect((accountResource.data as any).coin.value).toBe('123');
  },
  30 * 1000,
);

test(
  'submits multiagent transaction',
  async () => {
    const client = new AptosClient(NODE_URL);
    const faucetClient = new FaucetClient(NODE_URL, FAUCET_URL);
    const tokenClient = new TokenClient(client);

    const alice = new AptosAccount();
    const bob = new AptosAccount();
    const aliceAccountAddress = TxnBuilderTypes.AccountAddress.fromHex(alice.address());
    const bobAccountAddress = TxnBuilderTypes.AccountAddress.fromHex(bob.address());

    await faucetClient.fundAccount(alice.address(), 5000);

    let resources = await client.getAccountResources(alice.address());
    let accountResource = resources.find((r) => r.type === '0x1::Coin::CoinStore<0x1::TestCoin::TestCoin>');
    expect((accountResource.data as any).coin.value).toBe('5000');

    await faucetClient.fundAccount(bob.address(), 6000);
    resources = await client.getAccountResources(bob.address());
    accountResource = resources.find((r) => r.type === '0x1::Coin::CoinStore<0x1::TestCoin::TestCoin>');
    expect((accountResource.data as any).coin.value).toBe('6000');

    const collectionName = 'AliceCollection';
    const tokenName = 'Alice Token';

    // Create collection and token on Alice's account
    // eslint-disable-next-line quotes
    await tokenClient.createCollection(alice, collectionName, "Alice's simple collection", 'https://aptos.dev');

    await tokenClient.createToken(
      alice,
      collectionName,
      tokenName,
      // eslint-disable-next-line quotes
      "Alice's simple token",
      1,
      'https://aptos.dev/img/nyan.jpeg',
      0,
    );

    let aliceBalance = await tokenClient.getTokenBalance(alice.address().hex(), collectionName, tokenName);
    expect(aliceBalance.value).toBe('1');

    const scriptFunctionPayload = new TxnBuilderTypes.TransactionPayloadScriptFunction(
      TxnBuilderTypes.ScriptFunction.natual(
        '0x1::Token',
        'direct_transfer_script',
        [],
        [
          BCS.bcsToBytes(aliceAccountAddress),
          BCS.bcsSerializeStr(collectionName),
          BCS.bcsSerializeStr(tokenName),
          BCS.bcsSerializeUint64(1),
        ],
      ),
    );

    const [{ sequence_number: sequnceNumber }, chainId] = await Promise.all([
      client.getAccount(alice.address()),
      client.getChainId(),
    ]);

    const rawTxn = new TxnBuilderTypes.RawTransaction(
      aliceAccountAddress,
      BigInt(sequnceNumber),
      scriptFunctionPayload,
      1000n,
      1n,
      BigInt(Math.floor(Date.now() / 1000) + 10),
      new TxnBuilderTypes.ChainId(chainId),
    );

    const multiAgentTxn = new TxnBuilderTypes.MultiAgentRawTransaction(rawTxn, [bobAccountAddress]);

    const aliceSignature = new TxnBuilderTypes.Ed25519Signature(
      alice.signBuffer(TransactionBuilder.getSigningMessage(multiAgentTxn)).toUint8Array(),
    );

    const aliceAuthenticator = new TxnBuilderTypes.AccountAuthenticatorEd25519(
      new TxnBuilderTypes.Ed25519PublicKey(alice.signingKey.publicKey),
      aliceSignature,
    );

    const bobSignature = new TxnBuilderTypes.Ed25519Signature(
      bob.signBuffer(TransactionBuilder.getSigningMessage(multiAgentTxn)).toUint8Array(),
    );

    const bobAuthenticator = new TxnBuilderTypes.AccountAuthenticatorEd25519(
      new TxnBuilderTypes.Ed25519PublicKey(bob.signingKey.publicKey),
      bobSignature,
    );

    const multiAgentAuthenticator = new TxnBuilderTypes.TransactionAuthenticatorMultiAgent(
      aliceAuthenticator, // sender authenticator
      [bobAccountAddress], // secondary signer addresses
      [bobAuthenticator], // secondary signer authenticators
    );

    const bcsTxn = BCS.bcsToBytes(new TxnBuilderTypes.SignedTransaction(rawTxn, multiAgentAuthenticator));

    const transactionRes = await client.submitSignedBCSTransaction(bcsTxn);

    await client.waitForTransaction(transactionRes.hash);

    const transaction = await client.transactions.getTransaction(transactionRes.hash);
    expect((transaction.data as any)?.success).toBe(true);

    aliceBalance = await tokenClient.getTokenBalance(alice.address().hex(), collectionName, tokenName);

    expect(aliceBalance.value).toBe('0');
  },
  30 * 1000,
);
