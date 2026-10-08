(async()=>{
 const products=await (await fetch('/api/data/products')).json();
 const options={user:{id:'synthetic-admin',role:'admin'},isActive:()=>true,products:()=>products,api:async(path,options)=>{const response=await fetch(path,options);const result=await response.json();if(!response.ok)throw Object.assign(Error(result.error),{status:response.status});return result;}};
 DiningUI.mount(document.getElementById('diningRoot'),options);
 DiningKitchen.mount(document.getElementById('diningKitchenRoot'),options);
})();
