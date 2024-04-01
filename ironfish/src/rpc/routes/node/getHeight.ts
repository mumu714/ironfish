/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
import * as yup from 'yup'
import { Assert } from '../../../assert'
import { FullNode } from '../../../node'
import { RpcResponseError } from '../../adapters'
import { ApiNamespace } from '../namespaces'
import { routes } from '../router'

export type GetHeightRequest =
    | undefined
    | {
        stream?: boolean
    }

export type GetHeightResponse = {
    block: {
        height: number
        difficulty: string
        block_hash: string
        reward: string
        timestamp: number
    }
}

export const GetHeightRequestSchema: yup.ObjectSchema<GetHeightRequest> = yup
    .object({
        stream: yup.boolean().optional(),
    })
    .optional()
    .default({})

export const GetHeightResponseSchema: yup.ObjectSchema<GetHeightResponse> = yup
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

routes.register<typeof GetHeightRequestSchema, GetHeightResponse>(
    `${ApiNamespace.node}/getHeight`,
    GetHeightRequestSchema,
    async (request, context): Promise<void> => {
        Assert.isInstanceOf(context, FullNode)

        const status = await getHeight(context)

        request.end(status)
        return
    },
)

async function getHeight(node: FullNode): Promise<GetHeightResponse> {
    const header = node.chain.latest
    const block = await node.chain.getBlock(header)
    if (!block) {
        throw new RpcResponseError(`No block with header ${header.hash.toString('hex')}`)
    }

    const reward = abs(block.minersFee.fee()).toString()

    const chainHeader: GetHeightResponse = {
        block: {
            height: header.sequence,
            difficulty: header.target.toDifficulty().toString(),
            block_hash: header.hash.toString('hex'),
            reward: reward,
            timestamp: header.timestamp.valueOf(),
        },
    }

    return chainHeader
}

function abs(input: bigint): bigint {
    return input < 0n ? -input : input
}