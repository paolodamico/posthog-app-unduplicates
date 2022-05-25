import { Plugin, PluginEvent } from '@posthog/plugin-scaffold'
import { createHash, randomUUID } from 'crypto'
import { URLSearchParams } from 'url'

const NAMESPACE_OID = '6ba7b812-9dad-11d1-80b4-00c04fd430c8' // From RFC #4122

interface UnduplicatesPluginInterface {
    config: {
        dedupMode: 'Event and Timestamp' | 'All Properties'
    }
}

const stringifyEvent = (event: PluginEvent): string => {
    return `(${randomUUID().toString()}; project #${event.team_id}). Event "${event.event}" @ ${
        event.timestamp
    } for user ${event.distinct_id}.`
}

const byteToHex: string[] = []

for (let i = 0; i < 256; ++i) {
    byteToHex.push((i + 0x100).toString(16).slice(1))
}

function stringifyUUID(arr: Buffer) {
    // Forked from https://github.com/uuidjs/uuid (MIT)
    // Copyright (c) 2010-2020 Robert Kieffer and other contributors
    return (
        byteToHex[arr[0]] +
        byteToHex[arr[1]] +
        byteToHex[arr[2]] +
        byteToHex[arr[3]] +
        '-' +
        byteToHex[arr[4]] +
        byteToHex[arr[5]] +
        '-' +
        byteToHex[arr[6]] +
        byteToHex[arr[7]] +
        '-' +
        byteToHex[arr[8]] +
        byteToHex[arr[9]] +
        '-' +
        byteToHex[arr[10]] +
        byteToHex[arr[11]] +
        byteToHex[arr[12]] +
        byteToHex[arr[13]] +
        byteToHex[arr[14]] +
        byteToHex[arr[15]]
    ).toLowerCase()
}

const plugin: Plugin<UnduplicatesPluginInterface> = {
    processEvent: async (event, { config }) => {
        const stringifiedEvent = stringifyEvent(event)
        console.debug(`Beginning processing. ${stringifiedEvent}`)

        if (!event.timestamp) {
            console.info(
                'Received event without a timestamp, the event will not be processed because deduping will not work.'
            )
            return event
        }

        // Create a hash of the relevant properties of the event
        const stringifiedProps = config.dedupMode === 'All Properties' ? `_${JSON.stringify(event.properties)}` : ''
        const hash = createHash('sha1')
        const eventKeyBuffer = hash
            .update(
                `${NAMESPACE_OID}_${event.team_id}_${event.distinct_id}_${event.event}_${event.timestamp}${stringifiedProps}`
            )
            .digest()

        // Convert to UUID v5 spec
        eventKeyBuffer[6] = (eventKeyBuffer[6] & 0x0f) | 0x50
        eventKeyBuffer[8] = (eventKeyBuffer[8] & 0x3f) | 0x80

        event.uuid = stringifyUUID(eventKeyBuffer)
        return event
    },
}

module.exports = plugin
