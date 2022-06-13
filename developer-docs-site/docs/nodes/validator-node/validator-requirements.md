---
title: "Validator Requirements"
slug: "validator-requirements"
---

# Validator Requirements



:::info

For the AIT-2, we  recommend that every node operator run both a Validator node and a FullNode. If you follow the installation instructions then both the nodes will be installed by default. 

:::


:::note IMPORTANT

We strongly recommend that you run the validator node and the FullNode on two separate and independent machines. Make sure that these machines are well-provisioned and isolated from each other. Guaranteeing the resource isolation between the validator node and the FullNode will help ensure smooth deployment of these nodes.

:::

## Hardware requirements

We recommend the following hardware resources:

- For running an aptos node on incentivized testnet we recommend the following:

  - **CPU**: 4 cores (Intel Xeon Skylake or newer).
  - **Memory**: 8GiB RAM.

## Storage requirements

The amount of data stored by Aptos depends on the ledger history (length) of the blockchain and the number
of on-chain states (e.g., accounts). These values depend on several factors, including: the age of the blockchain,
the average transaction rate and the configuration of the ledger pruner.

We recommend nodes have at least 300GB of disk space to ensure adequate storage space for load testing. You have the option to start with a smaller size and adjust based upon demands. You will be responsible for monitoring your node's disk usage and adjusting appropriately to ensure node uptime.

## Networking configuration requirements

For Validator node:

- Open TCP port 6180, for validators to talk to each other.
- Open TCP port 9101, for getting validator metrics to validate the health stats. (only needed during registration stage)

For Fullnode:

- Open TCP port 6182, for fullnodes to talk to each other.
- Open TCP port 9101, for getting fullnode metrics to validate the health stats. (only needed during registration stage)
- Open TCP port 80/8080, for REST API access.

## Validator node in test mode 

You must run a validator node in test mode to be eligible for incentivized testnet. This is a method we use to verify that a node operator can successfully start a validator node, and have it properly configured with Aptos network identity. 

In test mode, you will be running a local network with one single node, and it should be functioning like a normal blockchain. You can configure an Aptos node in many ways: 

- Using Aptos source code.
- Using Docker, and 
- Using Terraform (for deploying with GCP, AWS and Azure). 

:::tip

For best availability and stability, we recommend that you deploy your node on the cloud. We have provided Terraform support for deploying the node on three cloud providers: GCP, AWS and Azure.

:::

Follow the links below to begin your installation:

* [Using GCP](using-gcp.md)
* [Using AWS](using-aws.md)
* [Using Docker](using-docker.md)
* [Using Aptos source code](using-source-code.md)

