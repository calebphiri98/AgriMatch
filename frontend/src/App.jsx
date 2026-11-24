import React,{createContext,useContext,useEffect,useState} from 'react';
import {Link,NavLink,Navigate,Route,Routes,useNavigate} from 'react-router-dom';
import {Menu,X,Leaf,LogOut,LayoutDashboard,PlusCircle,ShoppingBasket,Handshake,ClipboardList,UsersRound,PackageCheck,BarChart3,ShieldCheck,ArrowRight} from 'lucide-react';
import {api,getToken,clearToken,saveToken} from './api';
import {Loading,Pill,Alert} from './components';
import {Home,Login,Register} from './AuthPages';
import {Dashboard} from './CorePages';
import {AddProduce,MyProduce,FarmerMatches} from './FarmerPages';
import {PostDemand,MyDemands,BuyerMatches} from './BuyerPages';
import {AdminUsers,AdminProduce,AdminMatches,Reports} from './AdminPages';

const AuthContext=createContext(null);
export const useAuth=()=>useContext(AuthContext);
function AuthProvider({children}){
 const [user,setUser]=useState(null),[loading,setLoading]=useState(!!getToken());
 useEffect(()=>{if(!getToken()){setLoading(false);return;}api('/auth/me').then(r=>setUser(r.user)).catch(()=>clearToken()).finally(()=>setLoading(false));
  const reset=()=>{setUser(null);setLoading(false);};window.addEventListener('agrimatch-expired',reset);return()=>window.removeEventListener('agrimatch-expired',reset);},[]);
 const login=async(email,password)=>{const r=await api('/auth/login',{method:'POST',body:{email,password}});saveToken(r.token);setUser(r.user);return r.user;};
 const logout=()=>{clearToken();setUser(null);};
 const refresh=async()=>{const r=await api('/auth/me');setUser(r.user);};
 return <AuthContext.Provider value={{user,loading,login,logout,refresh}}>{children}</AuthContext.Provider>
}
const menus={
 farmer:[['/dashboard','Dashboard',LayoutDashboard],['/farmer/add-produce','Add Produce',PlusCircle],['/farmer/my-produce','My Produce',ShoppingBasket],['/farmer/matches','My Matches',Handshake]],
 buyer:[['/dashboard','Dashboard',LayoutDashboard],['/buyer/post-demand','Post Demand',PlusCircle],['/buyer/my-demands','My Demands',ClipboardList],['/buyer/matches','Matched Farmers',Handshake]],
 admin:[['/dashboard','Dashboard',LayoutDashboard],['/admin/farmers','Manage Farmers',UsersRound],['/admin/buyers','Manage Buyers',UsersRound],['/admin/produce','Manage Produce',ShoppingBasket],['/admin/matches','Manage Matches',Handshake],['/admin/reports','System Reports',BarChart3]]
};
function Brand({compact=false}){return <Link to="/" className="brand"><span className="brand-mark"><Leaf size={compact?22:24} strokeWidth={2.5}/></span><span><strong>AgriMatch</strong>{!compact&&<small>Connecting harvests to markets</small>}</span></Link>}
function Layout({children}){
 const {user,logout}=useAuth();const navigate=useNavigate();const [menu,setMenu]=useState(false);
 const links=user?menus[user.role]:[];
 return <div className="app-shell legacy-look">
 <header className={`site-header ${user?'logged-in':''}`}><div className="nav-inner"><Brand compact={true}/>
 {!user?<nav className="public-nav" aria-label="Public navigation"><Link to="/login" className="btn outline small">Login</Link><Link to="/register" className="btn primary small">Register</Link></nav>:<>
 <nav className={`top-role-nav ${menu?'open':''}`} aria-label="Dashboard navigation">{links.map(([href,title,Icon])=><NavLink end={href==='/dashboard'} to={href} key={href} onClick={()=>setMenu(false)} className={({isActive})=>`top-nav-link ${isActive?'active':''}`}><Icon size={16}/>{title}</NavLink>)}</nav>
 <div className="nav-account"><span className="account-name"><b>{user.full_name}</b><small>{user.role.charAt(0).toUpperCase()+user.role.slice(1)}</small></span><button type="button" onClick={()=>{logout();navigate('/');}} className="logout-btn" title="Log out"><LogOut size={18}/> <span>Logout</span></button></div>
 <button className="menu-toggle" type="button" onClick={()=>setMenu(x=>!x)} aria-expanded={menu} aria-label="Toggle navigation">{menu?<X size={24}/>:<Menu size={24}/>}</button>
 </>}
 </div></header>
 {user?<main className="app-main legacy-main">{user.status==='pending'&&<Alert type="warning">Your account is <strong>pending verification</strong>. An administrator will review your documents before you can {user.role==='farmer'?'post produce':'post demand'}.</Alert>}{children}</main>:<main className="public-main">{children}</main>}
 <footer className="footer legacy-footer"><span>© {new Date().getFullYear()} AgriMatch — Web-Based Aggregation and Matching System for Smallholder Farmers and Buyers in Rural Blantyre</span><small>Developed by Comfort Olesi (BIS/21/SS/027) | MUBAS</small></footer>
 </div>;
}
function Protected({children,roles}){
 const {user,loading}=useAuth();if(loading)return <Loading/>;if(!user)return <Navigate to="/login" replace/>;if(roles&&!roles.includes(user.role))return <Navigate to="/dashboard" replace/>;return children;
}
function PublicOnly({children}){const {user,loading}=useAuth();return loading?<Loading/>:user?<Navigate to="/dashboard" replace/>:children;}
export default function App(){return <AuthProvider><Layout><Routes>
 <Route path="/" element={<PublicOnly><Home/></PublicOnly>}/>
 <Route path="/login" element={<PublicOnly><Login/></PublicOnly>}/>
 <Route path="/register" element={<PublicOnly><Register/></PublicOnly>}/>
 <Route path="/dashboard" element={<Protected><Dashboard/></Protected>}/>
 <Route path="/profile" element={<Navigate to="/dashboard" replace/>}/>
 <Route path="/farmer/add-produce" element={<Protected roles={['farmer']}><AddProduce/></Protected>}/>
 <Route path="/farmer/my-produce" element={<Protected roles={['farmer']}><MyProduce/></Protected>}/>
 <Route path="/farmer/matches" element={<Protected roles={['farmer']}><FarmerMatches/></Protected>}/>
 <Route path="/buyer/post-demand" element={<Protected roles={['buyer']}><PostDemand/></Protected>}/>
 <Route path="/buyer/my-demands" element={<Protected roles={['buyer']}><MyDemands/></Protected>}/>
 <Route path="/buyer/matches" element={<Protected roles={['buyer']}><BuyerMatches/></Protected>}/>
 <Route path="/admin/farmers" element={<Protected roles={['admin']}><AdminUsers roleName="farmer"/></Protected>}/>
 <Route path="/admin/buyers" element={<Protected roles={['admin']}><AdminUsers roleName="buyer"/></Protected>}/>
 <Route path="/admin/produce" element={<Protected roles={['admin']}><AdminProduce/></Protected>}/>
 <Route path="/admin/matches" element={<Protected roles={['admin']}><AdminMatches/></Protected>}/>
 <Route path="/admin/reports" element={<Protected roles={['admin']}><Reports/></Protected>}/>
 <Route path="*" element={<section className="card"><h2>Page not found</h2><p>That page doesn't exist.</p><Link className="btn primary" to="/dashboard">Go to dashboard</Link></section>}/>
 </Routes></Layout></AuthProvider>}
