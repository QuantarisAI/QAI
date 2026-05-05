"use client";

import { useState } from 'react';
import { hydrogenTopics } from '../data/hydrogenTopics';

const categoryColors: Record<string, string> = {
    "nonmetal": "var(--teal)",
    "noble-gas": "var(--violet)",
    "alkali-metal": "var(--orange)",
    "alkaline-earth": "var(--amber)",
    "transition-metal": "var(--ice)",
    "metalloid": "var(--acid)",
    "post-transition": "var(--subtle)",
    "lanthanide": "var(--mint)",
    "actinide": "var(--rose)",
};

export default function HydrogenPage() {
    return (
        <main
            style={{ background: "var(--void)" }}
        >

            <div className="flex items-center gap-4 p-10">
                <div
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                    className="flex flex-col items-center justify-center w-24 h-24 rounded-lg">
                    <span style={{ color: "var(--muted)", fontFamily: "var(--font-mono)" }} className="text-[4rem]">
                        H
                    </span>
                </div >
                <div className="flex flex-col">
                    <p style={{ color: "var(--teal)" }} className="text-[2rem] font-bold">
                        Hydrogen
                    </p>
                    <p style={{ color: "var(--subtle)", fontFamily: "var(--font-mono)" }} className="text-[1rem]">
                        Maths for Machine Learning
                    </p>
                </div>
            </div>

            <div className="bg-gray-900 py-8">
                <div className="mx-auto max-w-2xl px-6 lg:max-w-7xl lg:px-8">
                    <div className="grid gap-4 sm:mt-16 lg:grid-cols-3 lg:grid-rows-2">
                        <div className="relative lg:row-span-2">
                            <div className="absolute inset-px rounded-lg bg-gray-800 lg:rounded-l-4xl" />
                            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(var(--radius-lg)+1px)] lg:rounded-l-[calc(2rem+1px)]">
                                <div className="px-8 pt-8 pb-3 sm:px-10 sm:pt-10 sm:pb-0">
                                    <p className="mt-2 text-lg font-medium tracking-tight text-white max-lg:text-center">Mobile friendly</p>
                                    <p className="mt-2 max-w-lg text-sm/6 text-gray-400 max-lg:text-center">
                                        Anim aute id magna aliqua ad ad non deserunt sunt. Qui irure qui lorem cupidatat commodo.
                                    </p>
                                </div>
                                <div className="@container relative min-h-120 w-full grow max-lg:mx-auto max-lg:max-w-sm">
                                    <div className="absolute inset-x-10 top-10 bottom-0 overflow-hidden rounded-t-[12cqw] border-x-[3cqw] border-t-[3cqw] border-gray-700 bg-gray-900 outline outline-white/20">
                                        <img
                                            alt=""
                                            src="https://tailwindcss.com/plus-assets/img/component-images/bento-03-mobile-friendly.png"
                                            className="size-full object-cover object-top"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="pointer-events-none absolute inset-px rounded-lg shadow-sm outline outline-white/15 lg:rounded-l-4xl" />
                        </div>
                        <div className="relative lg:row-span-2">
                            <div className="absolute inset-px rounded-lg bg-gray-800 max-lg:rounded-b-4xl lg:rounded-r-4xl" />
                            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(var(--radius-lg)+1px)] max-lg:rounded-b-[calc(2rem+1px)] lg:rounded-r-[calc(2rem+1px)]">
                                <div className="px-8 pt-8 pb-3 sm:px-10 sm:pt-10 sm:pb-0">
                                    <p className="mt-2 text-lg font-medium tracking-tight text-white max-lg:text-center">Powerful APIs</p>
                                    <p className="mt-2 max-w-lg text-sm/6 text-gray-400 max-lg:text-center">
                                        Sit quis amet rutrum tellus ullamcorper ultricies libero dolor eget sem sodales gravida.
                                    </p>
                                </div>
                                <div className="relative min-h-120 w-full grow">
                                    <div className="absolute top-10 right-0 bottom-0 left-10 overflow-hidden rounded-tl-xl bg-gray-900/60 outline outline-white/10">
                                        <div className="flex bg-gray-900 outline outline-white/5">
                                            <div className="-mb-px flex text-sm/6 font-medium text-gray-400">
                                                <div className="border-r border-b border-r-white/10 border-b-white/20 bg-white/5 px-4 py-2 text-white">
                                                    NotificationSetting.jsx
                                                </div>
                                                <div className="border-r border-gray-600/10 px-4 py-2">App.jsx</div>
                                            </div>
                                        </div>
                                        <div className="px-6 pt-6 pb-14">{/* Your code example */}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="pointer-events-none absolute inset-px rounded-lg shadow-sm outline outline-white/15 max-lg:rounded-b-4xl lg:rounded-r-4xl" />
                        </div>
                    </div>
                </div>
            </div>
        </main >
    );
}