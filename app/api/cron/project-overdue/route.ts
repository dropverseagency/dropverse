import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '../../../../lib/supabaseService'
import { createUserNotification } from '../../../../lib/userNotifications'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const admin = createServiceClient(); const now = new Date().toISOString()
  const { data: projects } = await admin.from('projects').select('id,title,user_id,assigned_freelancer_id,delivery_due_at').lt('delivery_due_at', now).in('operations_status', ['assigned','in_progress','revision_requested'])
  let notified=0
  for(const project of projects||[]) {
    const { data: prior }=await admin.from('project_events').select('id').eq('project_id',project.id).eq('event_type','delivery_overdue').maybeSingle()
    if(prior)continue
    await admin.from('project_events').insert({project_id:project.id,actor_kind:'system',event_type:'delivery_overdue',metadata:{dueAt:project.delivery_due_at,reassignmentSuggested:true}})
    await createUserNotification({userId:project.user_id,type:'project_overdue',title:'Project delivery is overdue',body:`${project.title} is overdue. Review it and consider reassignment.`,href:`/dashboard/projects/${project.id}`,entityType:'project',entityId:project.id})
    if(project.assigned_freelancer_id)await createUserNotification({userId:project.assigned_freelancer_id,type:'project_overdue',title:'Project delivery is overdue',body:`${project.title} has passed its delivery deadline.`,href:`/dashboard/projects/${project.id}`,entityType:'project',entityId:project.id})
    notified++
  }
  return NextResponse.json({ok:true,checked:(projects||[]).length,notified})
}
