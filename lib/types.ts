export type Role = 'user' | 'admin'
export type Category = { id:string; name:string; slug:string; description?:string; active:boolean }
export type Service = { id:string; category_id:string; title:string; slug:string; description:string; active:boolean }
export type Freelancer = { id:string; name:string; avatar_url?:string; bio?:string; specialty?:string; skills:string[]; tools:string[]; starting_price?:number; delivery_time?:string; active:boolean }
export type WorkSample = { id:string; freelancer_id:string; service_id:string; title:string; description:string; media_url?:string; thumbnail_url?:string; tools:string[]; price?:number; delivery_time?:string; featured:boolean }
