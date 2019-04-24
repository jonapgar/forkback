module.exports = {
	child(mod){
		if (!mod.parent) {

			process.on('message',({name,args,index})=>{
				try {
					mod.exports[name](...args,(...results)=>{
						process.send({name,results,index})
					})
				} catch (err) {
					process.send({name,results:[err + ''],index})
				}
			})
		}
	},
	fork(api,{instances=1,idle=5000,hash}){
		let mod = require(api)
		let callbacks = {}
		let index=0		
		let path = require.resolve(api)
		let children = Array(instances)
		let make = (payload)=>{
			
			let childIndex = (hash ? hash(payload):payload.index)%instances

			let child = children[childIndex]
			if (child) {
				return child
			}
			child = require('child_process').fork(path,{stdio:['ipc',1,2]})
			child.on('message',({name,results,index})=>{
				let {cb} = callbacks[index]
				delete callbacks[index]
				cb(...results)
			})	


			let rm =()=>{
				if (children[childIndex]===child)
					children[childIndex] = null
				clearInterval(interval)
			}
		
			child.on('exit',rm)
			
			let interval = setInterval(()=>{
				for (let k in callbacks) {
					if (callbacks[k].child===child)
						return
				}
				rm()
				child.kill('SIGINT')
			},idle)

			children[childIndex] = child
			return child
		}
		let forked = {}
		for (let name in mod) {
			forked[name] = function(...args){
				let cb = args.pop()
				index++
				let payload = {name,args,index}
				let child = make(payload)
				callbacks[index] = {cb,child}
				child.send(payload)
			}
		}
		delete require.cache[path]
		return forked
	}
}