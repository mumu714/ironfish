/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import { BufferUtils } from '@ironfish/sdk'
import { Args } from '@oclif/core'
import { IronfishCommand } from '../../command'
import { RemoteFlags } from '../../flags'

export default class Asset extends IronfishCommand {
  static description = 'Get the asset info'

  static args = {
    id: Args.string({
      required: true,
      description: 'The identifier of the asset',
    }),
  }

  static flags = {
    ...RemoteFlags,
  }

  async start(): Promise<void> {
    const { args } = await this.parse(Asset)
    const { id: assetId } = args

    const client = await this.sdk.connectRpc()
    const data = await client.chain.getAsset({ id: assetId })

    this.log(`Name: ${BufferUtils.toHuman(Buffer.from(data.content.name, 'hex'))}`)
    this.log(`Metadata: ${BufferUtils.toHuman(Buffer.from(data.content.metadata, 'hex'))}`)
    this.log(`Creator: ${data.content.creator}`)
    this.log(`Owner: ${data.content.owner}`)
    this.log(`Supply: ${data.content.supply ?? 'N/A'}`)
    this.log(`Identifier: ${data.content.id}`)
    this.log(`Transaction Created: ${data.content.createdTransactionHash}`)
  }
}
