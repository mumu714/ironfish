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

export type GetNodeBlockInfoRequest = {
    search?: string
    hash?: string
    height?: number
}

export type GetNodeBlockInfoResponse = {
    block: {
        height: number
        difficulty: string
        block_hash: string
        reward: string
        timestamp: number
    }
}

export const GetNodeBlockInfoRequestSchema: yup.ObjectSchema<GetNodeBlockInfoRequest> = yup
    .object()
    .shape({
        search: yup.string(),
        hash: yup.string(),
        height: yup.number(),
    })
    .defined()

export const GetNodeBlockInfoResponseSchema: yup.ObjectSchema<GetNodeBlockInfoResponse> = yup
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
    .defined()

routes.register<typeof GetNodeBlockInfoRequestSchema, GetNodeBlockInfoResponse>(
    `${ApiNamespace.node}/getBlockInfo`,
    GetNodeBlockInfoRequestSchema,
    async (request, context): Promise<void> => {
        Assert.isInstanceOf(context, FullNode)

        let header: BlockHeader | null = null
        let error = ''

        if (request.data.search) {
            const search = request.data.search.trim()
            const num = Number(search)

            if (Number.isInteger(num)) {
                request.data.height = num
            } else {
                request.data.hash = search
            }
        }

        // Use negative numbers to start from the head of the chain
        if (request.data.height && request.data.height < 0) {
            request.data.height = Math.max(
                context.chain.head.sequence + request.data.height + 1,
                GENESIS_BLOCK_SEQUENCE,
            )
        }

        if (request.data.hash) {
            const hash = Buffer.from(request.data.hash, 'hex')
            header = await context.chain.getHeader(hash)
            error = `No block found with hash ${request.data.hash}`
        }

        if (request.data.height && !header) {
            header = await context.chain.getHeaderAtSequence(request.data.height)
            error = `No block found with sequence ${request.data.height}`
        }

        if (!header) {
            throw new RpcResponseError(error)
        }

        const block = await context.chain.getBlock(header)
        if (!block) {
            throw new RpcResponseError(`No block with header ${header.hash.toString('hex')}`)
        }
        const reward = abs(block.minersFee.fee()).toString()

        request.end({
            block: {
                height: Number(header.sequence),
                difficulty: header.target.toDifficulty().toString(),
                block_hash: header.hash.toString('hex'),
                reward: reward,
                timestamp: header.timestamp.valueOf(),
            },
        })
    },
)

function abs(input: bigint): bigint {
    return input < 0n ? -input : input
}