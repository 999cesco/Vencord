/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Settings } from "@api/Settings";
import { VENCORD_USER_AGENT } from "@utils/constants";
import { debounce } from "@utils/debounce";
import { getCurrentChannel } from "@utils/discord";
import { useAwaiter } from "@utils/react";
import { findStoreLazy } from "@webpack";
import { UserStore } from "@webpack/common";

import { settings } from "./settings";
import { PronounCode, PronounMapping, PronounsResponse } from "./types";

const UserProfileStore = findStoreLazy("UserProfileStore");

export const enum PronounsFormat {
    Lowercase = "LOWERCASE",
    Capitalized = "CAPITALIZED"
}

export const enum PronounSource {
    PreferPDB,
    PreferDiscord
}

// A map of cached pronouns so the same request isn't sent twice
const cache: Record<string, PronounCode> = {};
// A map of ids and callbacks that should be triggered on fetch
const requestQueue: Record<string, ((pronouns: PronounCode) => void)[]> = {};

// Executes all queued requests and calls their callbacks
const bulkFetch = debounce(async () => {
    const ids = Object.keys(requestQueue);
    const pronouns = await bulkFetchPronouns(ids);
    for (const id of ids) {
        // Call all callbacks for the id
        requestQueue[id]?.forEach(c => c(pronouns[id]));
        delete requestQueue[id];
    }
});

function getDiscordPronouns(id: string) {
    return (
        UserProfileStore.getGuildMemberProfile(id, getCurrentChannel()?.guild_id)?.pronouns
        || UserProfileStore.getUserProfile(id)?.pronouns
    );
}

export function useFormattedPronouns(id: string, discordPronouns: string = getDiscordPronouns(id)): string | null {
    const [result] = useAwaiter(() => fetchPronouns(id, discordPronouns), {
        fallbackValue: getCachedPronouns(id, discordPronouns),
        onError: e => console.error("Fetching pronouns failed: ", e)
    });

    if (result && result !== "unspecified")
        return Object.hasOwn(PronounMapping, result)
            ? formatPronouns(result) // PronounDB
            : result; // Discord

    return null;
}

export function useProfilePronouns(id: string, discordPronouns: string) {
    const pronouns = useFormattedPronouns(id, discordPronouns);

    if (!settings.store.showInProfile) return null;
    if (!settings.store.showSelf && id === UserStore.getCurrentUser().id) return null;

    return pronouns;
}


// Gets the cached pronouns, if you're too impatient for a promise!
export function getCachedPronouns(id: string, discordPronouns: string): string | null {
    if (settings.store.pronounSource === PronounSource.PreferDiscord && discordPronouns)
        return discordPronouns;

    const cached = cache[id];
    if (cached && cached !== "unspecified") return cached;

    return discordPronouns || cached || null;
}

// Fetches the pronouns for one id, returning a promise that resolves if it was cached, or once the request is completed
export function fetchPronouns(id: string, discordPronouns: string): Promise<string> {
    return new Promise(res => {
        const cached = getCachedPronouns(id, discordPronouns);
        if (cached) return res(cached);

        // If there is already a request added, then just add this callback to it
        if (id in requestQueue) return requestQueue[id].push(res);

        // If not already added, then add it and call the debounced function to make sure the request gets executed
        requestQueue[id] = [res];
        bulkFetch();
    });
}

async function bulkFetchPronouns(ids: string[]): Promise<PronounsResponse> {
    const params = new URLSearchParams();
    params.append("platform", "discord");
    params.append("ids", ids.join(","));

    try {
        const req = await fetch("https://pronoundb.org/api/v1/lookup-bulk?" + params.toString(), {
            method: "GET",
            headers: {
                "Accept": "application/json",
                "X-PronounDB-Source": VENCORD_USER_AGENT
            }
        });
        return await req.json()
            .then((res: PronounsResponse) => {
                Object.assign(cache, res);
                return res;
            });
    } catch (e) {
        // If the request errors, treat it as if no pronouns were found for all ids, and log it
        console.error("PronounDB fetching failed: ", e);
        const dummyPronouns = Object.fromEntries(ids.map(id => [id, "unspecified"] as const));
        Object.assign(cache, dummyPronouns);
        return dummyPronouns;
    }
}

export function formatPronouns(pronouns: string): string {
    const { pronounsFormat } = Settings.plugins.PronounDB as { pronounsFormat: PronounsFormat, enabled: boolean; };
    // For capitalized pronouns, just return the mapping (it is by default capitalized)
    if (pronounsFormat === PronounsFormat.Capitalized) return PronounMapping[pronouns];
    // If it is set to lowercase and a special code (any, ask, avoid), then just return the capitalized text
    else if (
        pronounsFormat === PronounsFormat.Lowercase
        && ["any", "ask", "avoid", "other"].includes(pronouns)
    ) return PronounMapping[pronouns];
    // Otherwise (lowercase and not a special code), then convert the mapping to lowercase
    else return PronounMapping[pronouns].toLowerCase();
}
