// Copyright (c) Aptos
// SPDX-License-Identifier: Apache-2.0

use anyhow::Result;
use clap::Parser;

#[derive(Clone, Debug, Parser)]
pub struct GenerateOpenapi {}

pub async fn generate_openapi(args: GenerateOpenapi) -> Result<()> {
    Ok(())
}
