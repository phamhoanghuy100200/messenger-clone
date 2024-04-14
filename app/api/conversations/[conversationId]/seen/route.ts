import getCurrentUser from "@/app/actions/getCurrentUser"
import { NextResponse } from "next/server";
import prisma from '@/app/libs/prismadb'
import { pusherServer } from "@/app/libs/pusher";
interface Iparams {
    conversationId?: string
}
export async function POST(request: Request, { params }: { params: Iparams }) {
    try {
        const currentUser = await getCurrentUser();
        const {
            conversationId
        } = params;
        if (!currentUser?.id || !currentUser?.email) {
            return new NextResponse('Unauthorrized', { status: 401 })
        }
        const conversation = await prisma.conversation.findUnique({
            where: {
                id: conversationId
            },
            include: {
                messages: {
                    include: {
                        seen: true,
                    }
                },
                users: true,
            }
        })
        if (!conversation) {
            return new NextResponse('invalid ID', { status: 400 });
        }
        //find the last message
        const lastMessage = conversation.messages[conversation.messages.length - 1];
        if (!lastMessage) {
            return NextResponse.json(conversation);


        }
        //update seen of last message
        const updateMessage = await prisma.message.update({
            where: {
                id: lastMessage.id
            },
            include: {
                sender: true,
                seen: true
            },
            data: {
                seen: {
                    connect: {
                        id: currentUser.id
                    }
                }
            }
        })
        await pusherServer.trigger(currentUser.email, 'conversation:update', {
            id: conversationId,
            messages: [updateMessage]
        });

        if (lastMessage.seenIds.indexOf(currentUser.id) !== -1) {
            return NextResponse.json(conversation);
        }
        await pusherServer.trigger(conversationId!, 'message:update', updateMessage);

        return NextResponse.json(updateMessage)
    } catch (error: any) {
        console.log(error, 'Error_messsage_seen')
        return new NextResponse('Internal Error', { status: 500 })
    }

}