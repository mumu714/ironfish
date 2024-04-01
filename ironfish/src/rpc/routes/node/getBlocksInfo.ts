/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import * as yup from 'yup'
import { Assert } from '../../../assert'
import { FullNode } from '../../../node'
import { BlockHeader } from '../../../primitives'
import { GENESIS_BLOCK_SEQUENCE } from '../../../primitives/block'
import { RpcResponseError } from '../../adapters'
import { ApiNamespace } from '../namespaces'
import { routes } from '../router'

type BlockInfoResponse = {
    block: {
        height: number
        difficulty: string
        block_hash: string
        reward: string
        timestamp: number
    }
}
export default BlockInfoResponse

export type GetBlocksInfoRequest = {
    height: number
    number: number
}

export type GetBlocksInfoResponse = {
    blocks: Array<BlockInfoResponse>
}

export const GetBlocksInfoRequestSchema: yup.ObjectSchema<GetBlocksInfoRequest> = yup
    .object()
    .shape({
        height: yup.number(),
        number: yup.number(),
    })
    .defined()

export const GetBlocksInfoResponseSchema: yup.ObjectSchema<GetBlocksInfoResponse> = yup
    .object({
        blocks: yup
            .array(
                yup
                    .object({
                        block: yup
                            .object({
                                height: yup.number().defined(),
                                difficulty: yup.string().defined(),
                                block_hash: yup.string().defined(),
                                reward: yup.string().defined(),
                                timestamp: yup.number().defined(),
                            })
                            .defined(),
                    })
                    .defined(),
            )
            .defined(),
    })
    .defined()

routes.register<typeof GetBlocksInfoRequestSchema, GetBlocksInfoResponse>(
    `${ApiNamespace.node}/getBlocksInfo`,
    GetBlocksInfoRequestSchema,
    async (request, context): Promise<void> => {
        Assert.isInstanceOf(context, FullNode)

        const result: BlockInfoResponse[] = []
        let i: number
        for (i = 0; i < request.data.number; i++) {
            const blockinfo = await getBlockInfo(i + request.data.height, context)
            result.push(blockinfo)
        }
        request.end({ blocks: result })
    },
)

async function getBlockInfo(sequence: number, context: FullNode): Promise<BlockInfoResponse> {
    let header: BlockHeader | null = null

    // Use negative numbers to start from the head of the chain
    if (sequence && sequence < 0) {
        sequence = Math.max(context.chain.head.sequence + sequence + 1, GENESIS_BLOCK_SEQUENCE)
    }

    if (sequence && !header) {
        header = await context.chain.getHeaderAtSequence(sequence)
    }

    if (!header) {
        throw new RpcResponseError(`No block found with sequence ${sequence}`)
    }

    const block = await context.chain.getBlock(header)
    if (!block) {
        throw new RpcResponseError(`No block with header ${header.hash.toString('hex')}`)
    }
    const reward = abs(block.minersFee.fee()).toString()

    return {
        block: {
            height: Number(header.sequence),
            difficulty: header.target.toDifficulty().toString(),
            block_hash: header.hash.toString('hex'),
            reward: reward,
            timestamp: header.timestamp.valueOf(),
        },
    }
}

function abs(input: bigint): bigint {
    return input < 0n ? -input : input
}