import { query as q} from "faunadb";
import { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "next-auth/client";
import { fauna } from "../../services/fauna";
import { stripe } from "../../services/stripe";

type User = {
  ref:{
    id:string
  },
  data:{
    stripe_customer_id: string
  }
}

export default async (req: NextApiRequest, res:NextApiResponse) => {
  if(req.method='POST'){

    const session = await getSession({req})

    const faunaUser = await fauna.query<User>(
      q.Get(
        q.Match(
          q.Index('user_by_email'),
          q.Casefold(session.user.email)
        )
      )
    )
    
    let stripecustomerId = faunaUser.data.stripe_customer_id 

    if (!stripecustomerId){
      const stripecustomer = await stripe.customers.create({
        email:session.user.email
      })
  
      await fauna.query(
        q.Update(
          q.Ref(q.Collection('users'), faunaUser.ref.id),
          {
            data:{
              stripe_customer_id: stripecustomer.id
            }
          }
        ) 
      )
      
      stripecustomerId=stripecustomer.id
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer:stripecustomerId,
      payment_method_types:['card'],
      billing_address_collection:'required',
      line_items:[{price:'price_1IjBjnKDWx7pNBoQLFjIpalS', quantity:1}],
      mode:'subscription',
      allow_promotion_codes:true,
      success_url:'http://localhost:3000/post',
      cancel_url:'http://localhost:3000/'
    })

    return res.status(200).json({sessionId: checkoutSession.id})
  }else{
    res.setHeader('Allow', 'POST')
    res.status(405).end('Method not Allowed')
  }
}