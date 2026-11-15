import React from 'react'
import Image from "next/image";
import {Tabs, TabsList, TabsTrigger} from "@/components/ui/tabs";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {BadgeInfoIcon, Calendar, Gamepad, LocateIcon, Mail, Sparkles, Star} from "lucide-react";
import {TextField} from "@/components/TextField";
import Post from "@/components/Post";

const Content = () => {
    return (
        <section className="w-full max-w-4/5 mx-auto p-4 h-full ">

            <div className="grid grid-cols-5 grid-rows-5 gap-8 h-full">
                <div>
                    <div className=" -mt-24">

                        <Image src="/profile.jpg" alt="Placeholder" width={150} height={150} className="w-full h-auto"/>
                    </div>
                    <div className={"mt-4 "}>
                        <Card size="sm" className="mx-auto w-full max-w-xs p-0">
                            <CardHeader className="bg-muted-bg w-full p-2">
                                <CardTitle className="">Information</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="grid gap-4 py-2 text-sm">
                                    <li className="flex gap-2">
                                        <Star className="mt-0.5 size-4 shrink-0 text-muted-foreground"/>
                                        <span><strong>Role:</strong> Captain</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <Calendar className="mt-0.5 size-4 shrink-0 text-muted-foreground"/>
                                        <span><strong>Birthdate:</strong> May 5, 2007</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground"/>
                                        <span className="text-wrap"><strong>Email:</strong> luffy@onepiece.com</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <LocateIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground"/>
                                        <span><strong>Location:</strong> East Blue</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <Gamepad className="mt-0.5 size-4 shrink-0 text-muted-foreground"/>
                                        <span><strong>Interests:</strong> Eating, Fighting, Adventure</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <Sparkles className="mt-0.5 size-4 shrink-0 text-muted-foreground"/>
                                        <span><strong>Dream:</strong> Become the Pirate King</span>
                                    </li>

                                    <li className="flex gap-2">
                                        <BadgeInfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground"/>
                                        <span>
                                            <strong>About:</strong> Just a rubber guy sailing the seas with my nakama. Don&#39;t touch my hat, don&#39;t steal my meat, and let&#39;s go on an adventure! 👒🍖
                                        </span>
                                    </li>


                                </ul>
                            </CardContent>

                        </Card>
                    </div>
                </div>
                <div className="col-span-3">
                    <div className=" -mt-24">
                        <h1 className="text-4xl font-semibold font-wordmark text-foreground/70 mb-2">Monkey D. Luffy</h1>
                        <Tabs defaultValue="home" className="w-full">
                            <TabsList className="h-14 p-1.5 gap-2">
                                <TabsTrigger
                                    value="home"
                                    className="h-full px-6 text-lg font-semibold"
                                >
                                    Wall
                                </TabsTrigger>
                                <TabsTrigger
                                    value="info"
                                    disabled
                                    className="h-full px-6 text-lg font-semibold "
                                >
                                    Info
                                </TabsTrigger>
                                <TabsTrigger
                                    value="photos"
                                    disabled
                                    className="h-full px-6 text-lg font-semibold "
                                >
                                    Photos
                                </TabsTrigger>
                                <TabsTrigger
                                    value="account"
                                    disabled
                                    className="h-full px-6 text-lg font-semibold "
                                >
                                    Account
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                    <div>
                        <TextField />
                        <Post/>
                    </div>
                </div>
                <div className="col-start-5 border-l-4 p-8 ">Advertisement</div>
            </div>

        </section>
    )
}

export default Content