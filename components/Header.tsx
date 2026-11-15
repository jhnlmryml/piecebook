import React from 'react'
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar";
import {BadgeQuestionMark, Search, Settings} from "lucide-react";
import {InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput} from "@/components/ui/input-group";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {Item, ItemContent, ItemDescription, ItemMedia, ItemTitle} from "@/components/ui/item";
import {Button} from "@/components/ui/button";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";

const Header = () => {
    const people = [
        {
            username: "Zoro",
            avatar: "https://github.com/shadcn.png",
            email: "shadcn@vercel.com",
        },
        {
            username: "Nami",
            avatar: "https://github.com/maxleiter.png",
            email: "maxleiter@vercel.com",
        },
        {
            username: "Sanji",
            avatar: "https://github.com/evilrabbit.png",
            email: "evilrabbit@vercel.com",
        },
    ]
    return (

        <header className="w-full h-[20vh] bg-muted-bg border-b-2 select-none">
            <div className="fixed inset-x-0 top-0 z-50">
                <nav className="flex items-center justify-between w-full max-w-4/5 mx-auto px-4 py-3 bg-highlight rounded-b-sm">

                    {/* Left Section */}
                    <div className="flex items-center gap-8 ">
                        <h1 className="font-extrabold font-wordmark text-2xl text-white">
                            Piecebook
                        </h1>
                        <ul className="flex items-center gap-6 ml-10 font-sans text-muted font-extralight">
                            <li className="text-white font-semibold">Home</li>
                            <li className="">Profile</li>
                            <li className="">Friends</li>
                            <li className="">Messages</li>
                        </ul>
                        <div className="w-64">
                            <InputGroup className="bg-white">
                                <InputGroupInput placeholder="Search..."/>
                                <InputGroupAddon align="inline-end">
                                    <InputGroupButton>
                                        <Search className="h-4 w-4"/>
                                    </InputGroupButton>
                                </InputGroupAddon>
                            </InputGroup>
                        </div>
                    </div>

                    {/* Right Section */}
                    <ul className="flex items-center gap-3 text-muted font-extralight">
                        <li className="whitespace-nowrap">
                            Monkey D. Luffy
                        </li>
                        <li className="flex items-center ">
                            <Settings className="h-5 w-5"/>
                        </li>
                        <li className="flex items-center">
                            <DropdownMenu>
                                <DropdownMenuTrigger render={
                                    <Button variant="ghost" size="icon" className="rounded-full"><Avatar>
                                        <AvatarImage src="/profile.jpg" alt="shadcn"/>
                                        <AvatarFallback>ML</AvatarFallback>
                                    </Avatar></Button>}
                                />
                                <DropdownMenuContent align="end" className="w-full">
                                    <DropdownMenuGroup>
                                        <DropdownMenuLabel >
                                            <Tooltip >
                                                <TooltipTrigger className="w-full flex items-center gap-2"><BadgeQuestionMark className="h-4 w-4"/> Switch Account</TooltipTrigger>
                                                <TooltipContent >
                                                    <p>Switch account to check realtime update</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </DropdownMenuLabel>


                                        {people.map((person) => (
                                            <DropdownMenuItem key={person.username}>
                                                <Item size="xs" className="w-full p-2">
                                                    <ItemMedia>
                                                        <Avatar className="size-[--spacing(6.5)]">
                                                            <AvatarImage src={person.avatar} className="grayscale"/>
                                                            <AvatarFallback>{person.username.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                    </ItemMedia>
                                                    <ItemContent className="gap-0">
                                                        <ItemTitle>{person.username}</ItemTitle>
                                                        <ItemDescription className="leading-none">
                                                            {person.email}
                                                        </ItemDescription>
                                                    </ItemContent>
                                                </Item>
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </li>
                    </ul>

                </nav>
            </div>
        </header>
    )
}
export default Header
