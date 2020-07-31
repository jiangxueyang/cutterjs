import {isObject, isEmpty, isNumber, warn, toFixed, isFunction} from '../utils'
export default class {
	constructor(config = {}) {
		this.rotate = 0 // 旋转角度
		this.dragStatus = 0 // 拖拽状态
		this.cursorEnums = ['default', 'nw-resize', 'w-resize', 'sw-resize', 'n-resize', 's-resize', 'ne-resize', 'e-resize', 'se-resize', 'move'] // 鼠标状态
		this.cutterIsEnter = false // 鼠标是否进入裁剪区域
		this.ropperIsDown = false // 鼠标是否在裁剪区域按下
		this.startPos = null // 开始坐标
		/* 默认配置 */
		this.defaultConfig = {
			cutWidth: 200, // 裁剪区域默认宽度，单位px
			cutHeight: 200, // 裁剪区域默认高度，单位px
			mincutWidth: 16, // 裁剪区域最小宽度，单位px
			mincutHeight: 16, // 裁剪区域最小高度，单位px
			maxScale: 3, // 图片能放大的最大倍数，相对图片原始尺寸
			minScale: 0.1, // 图片能缩小的最小倍数，相对图片原始尺寸
			scale: 1.2, // 每次放大的倍数，必须大于1，缩小为1/scale
			canMagnify: true, // boolean 是否可放大
			canReduce: true, // boolean 是否可缩小
			canRotate: true, // boolean 能否逆时针旋转图片
			canChangeCutSize: true, // boolean 能否改变裁剪区域大小，默认true
			imageSrc: '', // 图片资源, 必传
			containerEl: '', // 裁剪操作容器，图片与裁剪框将展示在这个区域，可为类名、id
			mangnifyEl: '', // 放大图片的dom元素，可为类名、id
			reduceEl: '', // 缩小图片的dom元素，可为类名、id
			cutEl: '', // 触发裁剪的dom元素，可为类名、id
			rotateEl: '', // 触发逆时针旋转的dom元素，可为类名、id
			onRender: null, // 渲染成功回调
			onCut: null // 裁剪成功回调
		}
		if (!this.checkConfig(config)) return
		this.init()
	}
	/* 检查配置信息是否合法 */
	checkConfig(config) {
		if (isEmpty(config)) return false
		if (!isObject(config)) return warn('配置信息格式不合法')
		let arr = ['cutWidth', 'cutHeight', 'mincutWidth', 'mincutHeight', 'maxScale', 'minScale', 'scale']
		arr.forEach((key) => {
			if (config.hasOwnProperty(key)) {
				config[key] = parseFloat(config[key])
			}
		})
		config = {...this.defaultConfig, ...config}
		let {containerEl, mincutWidth, mincutHeight, cutWidth, cutHeight, maxScale, minScale, canReduce, canMagnify} = config
		// 判断containerEl
		if (isEmpty(containerEl)) return warn('containerEl未配置')
		let container = document.querySelector(containerEl)
		if (!container) return warn(containerEl + '的dom元素不存在')
		this.container = container
		//判断mincutWidth, mincutHeight
		if (config.canChangeCutSize) {
			if (!isEmpty(mincutHeight)) {
				if (!isNumber(mincutHeight)) return warn('mincutHeight必须为数值')
				if (Number(mincutHeight) < 1) return warn('mincutHeight不能小于1')
			}
			if (!isEmpty(mincutWidth)) {
				if (!isNumber(mincutWidth)) return warn('mincutWidth必须为数值')
				if (Number(mincutWidth) < 1) return warn('mincutWidth不能小于1')
			}
		}
		// 判断cutWidth， cutHeight
		if (!isEmpty(cutWidth)) {
			if (!isNumber(cutWidth)) return warn('cutWidtht必须为数值')
			if (Number(cutWidth) < 1) return warn('cutWidth不能小于1')
		}
		if (!isEmpty(cutHeight)) {
			if (!isNumber(cutHeight)) return warn('cutHeight必须为数值')
			if (Number(cutHeight) < 1) return warn('cutHeight不能小于1')
		}
		// 判断放大缩小相关参数
		if (canMagnify) {
			if (!isEmpty(maxScale)) {
				if (!isNumber(maxScale)) return warn('maxScale必须为数值')
				if (Number(maxScale) < 1) return warn('maxScale不能小于1')
			}
			let {mangnifyEl} = config
			if (isEmpty(mangnifyEl)) return warn('mangnifyEl未配置')
			let mangnifyNode = document.querySelector(mangnifyEl)
			if (!mangnifyNode) return warn(mangnifyEl + '的dom元素不存在')
			this.mangnifyNode = mangnifyNode
		}
		if (canReduce) {
			if (!isEmpty(minScale)) {
				if (!isNumber(minScale)) return warn('minScale必须为数值')
				if (Number(minScale) >= 1) return warn('minScale必须小于1')
			}
			let {reduceEl} = config
			if (isEmpty(reduceEl)) return warn('reduceEl未配置')
			let reduceNode = document.querySelector(reduceEl)
			if (!reduceNode) return warn(reduceEl + '的dom元素不存在')
			this.reduceNode = reduceNode
		}
		if (canMagnify || canReduce) {
			let {scale} = this
			if (!isEmpty(scale)) {
				if (!isNumber(scale)) return warn('scale必须为数值')
				if (Number(maxScale) <= 1) return warn('scale必须大于1')
			}
		}
		/* 触发裁剪的dom校验 */
		let {cutEl} = config
		if (!isEmpty(cutEl)) {
			let submitNode = document.querySelector(cutEl)
			if (!submitNode) return warn(cutEl + '的dom不存在')
			this.submitNode = submitNode
		}
		/* 判断imageSrc*/
		let {imageSrc} = config
		if (isEmpty(imageSrc)) return warn('imageSrc不能为空')
		/* 判断是否可旋转 */
		let {canRotate, rotateEl} = config
		if (canRotate) {
			if (isEmpty(rotateEl)) return warn('rotateEl未配置')
			let rotateNode = document.querySelector(rotateEl)
			if (!rotateNode) return warn(rotateEl + '的dom不存在')
			this.rotateNode = rotateNode
		}
		this.config = config
		return true
	}
	init() {
		this.canvas = document.createElement('canvas')
		this.loadImage(() => {
			this.initContainer()
			let {onRender} = this.config
			if (isFunction(onRender)) onRender()
			this.bindEvent()
		})
	}
	/* 加载图片 */
	loadImage(cb) {
		let {imageSrc} = this.config
		let image = new Image()
		image.src = imageSrc
		image.onload = () => {
			this.image = image
			isFunction(cb) && cb()
		}
		image.onerror = () => {
			warn('图片资源加载失败')
		}
	}
	/* 初始化裁剪容器和尺寸 */
	initContainer() {
		let {container, image} = this
		let orgImgH = image.naturalHeight
		let orgImgW = image.naturalWidth
		let containerH = container.offsetHeight
		let containerW = container.offsetWidth
		this.containerH = containerH
		this.containerW = containerW
		this.orgImgW = orgImgW
		this.orgImgH = orgImgH
		let imgWidth = orgImgW
		let imgHeight = orgImgH
		let imgRatio = orgImgW / orgImgH
		let wrapRatio = containerW / containerH

		if (imgHeight > containerH) {
			if (imgWidth > containerW) {
				if (imgRatio < wrapRatio) {
					imgHeight = containerH
					imgWidth = imgHeight * imgRatio
				} else {
					imgWidth = containerW
					imgHeight = imgWidth / imgRatio
				}
			} else {
				imgWidth = containerW
				imgHeight = imgWidth / imgRatio
			}
		} else {
			if (imgWidth > containerW) {
				imgHeight = containerH
				imgWidth = imgHeight * imgRatio
			}
		}
		let res = this.adjustToCut(imgWidth, imgHeight)
		imgWidth = toFixed(res.imgWidth)
		imgHeight = toFixed(res.imgHeight)
		image.style.width = imgWidth + 'px'
		image.style.height = imgHeight + 'px'
		let top = (containerH - imgHeight) / 2
		let left = (containerW - imgWidth) / 2
		this.imgWidth = imgWidth
		this.imgHeight = imgHeight
		image.style.top = top + 'px'
		image.style.left = left + 'px'
		this.imgTop = top
		this.imgLeft = left
		image.style.position = 'absolute'
		container.style.position = 'relative'
		container.style.overflow = 'hidden'
		container.appendChild(image)
		this.addMask()
	}
	/* 添加蒙层 */
	addMask() {
		let {container, containerH, containerW} = this
		let {cutHeight, cutWidth} = this.config
		let cutterBox = document.createElement('div')
		cutterBox.setAttribute('style', 'position:absolute;box-sizing: border-box;border: 1px dashed #fff;')
		let leftMask = this.createMask()
		let rightMask = this.createMask()
		let topMask = this.createMask()
		let bottomMask = this.createMask()
		leftMask.style.left = 0
		rightMask.style.right = 0
		topMask.style.top = 0
		bottomMask.style.bottom = 0
		let array = [leftMask, rightMask, topMask, bottomMask, cutterBox]
		array.forEach(el => {
			container.appendChild(el)
		})
		this.cutterBox = cutterBox
		this.leftMask = leftMask
		this.rightMask = rightMask
		this.topMask = topMask
		this.bottomMask = bottomMask
		let left = (containerW - cutWidth) / 2
		let top = (containerH - cutHeight) / 2
		this.setMaskStyle(left, top, cutWidth, cutHeight)
	}
	/* 设置mask和cutterBox的样式 */
	setMaskStyle(left, top, cutWidth, cutHeight) {
		let {cutterBox, leftMask, rightMask, bottomMask, topMask, containerW, containerH} = this
		cutterBox.style.top = top + 'px'
		cutterBox.style.left = left + 'px'
		cutterBox.style.width = cutWidth + 'px'
		cutterBox.style.height = cutHeight + 'px'
		rightMask.style.width = containerW - left - cutWidth + 'px'
		leftMask.style.width = left + 'px'
		leftMask.style.height = rightMask.style.height = containerH + 'px'
		topMask.style.width = bottomMask.style.width = cutWidth + 'px'
		bottomMask.style.height = containerH - top - cutHeight + 'px'
		topMask.style.height = top + 'px'
		topMask.style.left = bottomMask.style.left = left + 'px'
		this.config.cutWidth = cutWidth
		this.config.cutHeight = cutHeight
		this.cutTop = top
		this.cutLeft = left
	}
	createMask() {
		let node = document.createElement('div')
		node.style.position = 'absolute'
		node.style.background = 'rgba(255, 255, 255, 0.45)'
		return node
	}
	/* 绑定事件 */
	bindEvent() {
		let {container, cutterBox} = this
		cutterBox.onmouseenter = (e) => {
			this.cutterIsEnter = true
			this.initMouse(e)
			container.onmousemove = (e) => {
				if (!this.cutterIsEnter) return
				if (this.cutterIsDown) {
					this.handleResize(e)
				} else {
					this.initMouse(e)
				}
			}
			container.onmousedown = (e) => {
				if (!this.cutterIsEnter) return
				if (this.dragStatus <= 0) return
				this.cutterIsDown = true
				this.handleMouseDown(e)
				container.onmouseup = () => {
					if (!this.cutterIsDown) return
					this.cutterIsDown = false
					this.checkCutterBox()
					container.onmouseup = null
				}
			}
		}
		container.onmouseleave = () => {
			this.cutterIsEnter = false
			this.dragStatus = 0
			this.cutterIsDown = false
			container.onmousemove = null
			container.onmousedown = null
			container.onmouseup = null
			this.checkCutterBox()
		}
		let {canRotate, canMagnify, canReduce, scale} = this.config
		/* 放大 */
		if (canMagnify && this.mangnifyNode) {
			this.mangnifyNode.onclick = () => {
				if (!this.config.canMagnify) return
				this.changeImageSize(scale)
			}
		}
		/* 缩小 */
		if (canReduce && this.reduceNode) {
			this.reduceNode.onclick = () => {
				if (!this.config.canReduce) return
				this.changeImageSize(1 / scale)
			}
		}
		/* 逆时针旋转图片 */
		if (canRotate && this.rotateNode) {
			this.rotateNode.onclick = () => {
				this.rotateImage()
			}
		}
		/* 裁剪 */
		if (this.submitNode) {
			this.submitNode.onclick = () => {
				this.cutImage()
			}
		}
	}
	/* 裁剪图片 */
	cutImage() {
		let {canvas, rotate, orgImgW, imgHeight, imgWidth, imgTop, imgLeft, cutLeft, cutTop, image, containerW, containerH} = this
		let {cutHeight, cutWidth, onCut} = this.config
		let scale = imgWidth / orgImgW
		let ctx = canvas.getContext('2d')
		let sWidth = cutWidth / scale
		let sHeight = cutHeight / scale
		canvas.width = cutWidth
		canvas.height = cutHeight
		if (rotate === -1) {
			let sx = toFixed((containerH - cutHeight - cutTop - (containerH - imgWidth) / 2) / scale)
			let sy = toFixed((cutLeft - (containerW - imgHeight) / 2) / scale)
			sWidth = cutHeight / scale
			sHeight = cutWidth / scale
			ctx.rotate((90 * rotate * Math.PI) / 180)
			ctx.drawImage(image, sx, sy, sWidth, sHeight, -cutHeight, 0, cutHeight, cutWidth)
		} else if (rotate === -2) {
			let sx = this.toFixed((containerW - cutLeft - cutWidth - (containerW - imgWidth) / 2) / scale)
			let sy = this.toFixed((containerH - cutHeight - cutTop - (containerH - imgHeight) / 2) / scale)
			ctx.rotate((90 * rotate * Math.PI) / 180)
			ctx.drawImage(image, sx, sy, sWidth, sHeight, -cutWidth, -cutHeight, cutWidth, cutHeight)
		} else if (rotate === -3) {
			let sx = this.toFixed((cutTop - (containerH - imgWidth) / 2) / scale)
			let sy = this.toFixed((containerW - cutLeft - cutWidth - (containerW - imgHeight) / 2) / scale)
			sWidth = cutHeight / scale
			sHeight = cutWidth / scale
			ctx.rotate((90 * rotate * Math.PI) / 180)
			ctx.drawImage(image, sx, sy, sWidth, sHeight, 0, -cutWidth, cutHeight, cutWidth)
		} else {
			let sx = (cutLeft - imgLeft) / scale
			let sy = (cutTop - imgTop) / scale
			ctx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, cutWidth, cutHeight)
		}
		let cutImgSrc = canvas.toDataURL('image/png')
		if (isFunction(onCut)) onCut(cutImgSrc)
		return cutImgSrc
	}
	/* 改变图片尺寸 */
	changeImageSize(scale) {
		let {imgWidth, orgImgW, orgImgH, imgHeight, containerH, containerW, image} = this
		let {maxScale, minScale, onManify, onReduce} = this.config
		imgWidth *= scale
		imgHeight *= scale
		if (scale > 1) {
			this.config.canReduce = true
			/* 不能超过最大放大比例 */
			if (imgWidth / orgImgW > maxScale) {
				this.config.canMagnify = false
				imgWidth = orgImgW * maxScale
				imgHeight = orgImgH * maxScale
			}
		} else {
			this.config.canMagnify = true
			/* 不能小于最小缩小比例 */
			if (imgWidth / orgImgW < minScale) {
				this.containerH.canReduce = false
				imgWidth = orgImgW * minScale
				imgHeight = orgImgH * minScale
			}
		}
		/* 图片不能小于cutterBox的尺寸 */
		let res = this.adjustToCut(imgWidth, imgHeight)
		imgWidth = toFixed(res.imgWidth)
		imgHeight = toFixed(res.imgHeight)

		this.imgWidth = imgWidth
		this.imgHeight = imgHeight
		image.style.width = imgWidth + 'px'
		image.style.height = imgHeight + 'px'
		let top = toFixed((containerH - imgHeight) / 2)
		let left = toFixed((containerW - imgWidth) / 2)
		image.style.top = top + 'px'
		image.style.left = left + 'px'
		this.imgTop = top
		this.imgLeft = left
		this.checkCutterBox()
		if (scale > 1 && isFunction(onManify)) onManify(this.config)
		if (scale < 1 && isFunction(onReduce)) onReduce(this.config)
	}
	/* 逆时针旋转图片 */
	rotateImage() {
		let {rotate, image} = this
		rotate -= 1
		if (rotate % 4 === 0) {
			rotate = 0
		}
		image.style.transform = `rotate(${90 * rotate}deg)`
		this.rotate = rotate
		this.checkCutterBox()
	}
	/* 初始化鼠标状态 */
	initMouse(e) {
		e.preventDefault()
		if (!this.cutterIsEnter) return
		let {cutterBox, cursorEnums, container} = this
		let {cutWidth, cutHeight, canChangeCutSize} = this.config
		let {clientX, clientY} = e
		let {top, left} = cutterBox.getBoundingClientRect()
		let offsetX = clientX - left
		let offsetY = clientY - top
		let size = 10
		let status = 0
		if (offsetX < size && offsetX > -size) {
			if (offsetY < size && offsetY > -size) {
				// 左上角
				status = 1
			} else if (offsetY >= size && offsetY <= cutHeight - size) {
				// 左侧
				status = 2
			} else if (offsetY > cutHeight - size && offsetY < cutHeight + size) {
				// 左下角
				status = 3
			}
		} else if (offsetX >= size && offsetX <= cutWidth - size) {
			if (offsetY < size && offsetY > -size) {
				// 上
				status = 4
			} else if (offsetY > cutHeight - size && offsetY < cutHeight + size) {
				// 下
				status = 5
			} else if (offsetY >= size && offsetY <= cutHeight - size) {
				// 中间
				status = 9
			}
		} else if (offsetX > cutWidth - size && offsetX < cutWidth + size) {
			if (offsetY < size && offsetY > -size) {
				// 右上角
				status = 6
			} else if (offsetY >= size && offsetY <= cutHeight - size) {
				// 右侧
				status = 7
			} else if (offsetY > cutHeight - size && offsetY < cutHeight + size) {
				// 右下角
				status = 8
			}
		}
		if (canChangeCutSize || (!canChangeCutSize && status === 9)) {
			cutterBox.style.cursor = cursorEnums[status] || 'default'
			this.dragStatus = status
		}
		if (offsetX < -size || offsetX > cutWidth + size || offsetY < -size || offsetY > cutHeight + size) {
			this.cutterIsEnter = false
			this.cutterIsDown = false
			container.onmousemove = null
			container.onmousedown = null
			container.onmouseup = null
		}
	}
	/* 移动鼠标改变尺寸和位置 */
	handleResize(e) {
		e.preventDefault()
		let {cutWidth, cutHeight, mincutWidth} = this.config
		let {cutTop, cutLeft, startPos, dragStatus, containerW, containerH} = this
		let moveX = e.clientX - startPos.clientX
		let moveY = e.clientY - startPos.clientY
		if (dragStatus >= 1 && dragStatus <= 3) {
			// 左侧
			let newWidth = cutWidth - moveX
			let newLeft = cutLeft + moveX
			let newHeight = cutHeight
			let newTop = cutTop
			if (newWidth < mincutWidth) return
			if (newLeft < 0) {
				newLeft = 0
			}
			if (dragStatus === 1) {
				// 左上角 与右上角一样
				let res = this.resizeTop(cutHeight, cutTop, moveY)
				newHeight = res.newHeight
				newTop = res.newTop
			} else if (dragStatus === 3) {
				let res = this.resizeBottom(cutHeight, cutTop, moveY)
				newHeight = res.newHeight
			}
			this.setMaskStyle(newLeft, newTop, newWidth, newHeight)
		} else if (dragStatus === 4) {
			let res = this.resizeTop(cutHeight, cutTop, moveY)
			let newHeight = res.newHeight
			let newTop = res.newTop
			this.setMaskStyle(cutLeft, newTop, cutWidth, newHeight)
		} else if (dragStatus === 5) {
			let res = this.resizeBottom(cutHeight, cutTop, moveY)
			let newHeight = res.newHeight
			this.setMaskStyle(cutLeft, cutTop, cutWidth, newHeight)
		} else if (dragStatus >= 6 && dragStatus <= 8) {
			// 右侧
			let newWidth = cutWidth + moveX
			let newTop = cutTop
			let newHeight = cutHeight
			if (newWidth < mincutWidth) return
			if (cutLeft + newWidth > containerW) {
				newWidth = containerW - cutWidth
			}
			if (dragStatus === 6) {
				// 右上角
				let res = this.resizeTop(cutHeight, cutTop, moveY)
				newHeight = res.newHeight
				newTop = res.newTop
			} else if (dragStatus === 8) {
				// 右下角
				let res = this.resizeBottom(cutHeight, cutTop, moveY)
				newHeight = res.newHeight
			}
			this.setMaskStyle(cutLeft, newTop, newWidth, newHeight)
		} else if (dragStatus === 9) {
			let newLeft = cutLeft + moveX
			let newTop = cutTop + moveY
			if (newTop < 0) newTop = 0
			if (newLeft < 0) newLeft = 0
			if (newLeft + cutWidth > containerW) newLeft = containerW - cutWidth
			if (newTop + cutHeight > containerH) newTop = containerH - cutHeight
			this.setMaskStyle(newLeft, newTop, cutWidth, cutHeight)
		}
		this.startPos = {clientX: e.clientX, clientY: e.clientY}
	}
	/* 判断cuttererbox的位置是否超过image */
	checkCutterBox() {
		let {cutHeight, cutWidth} = this.config
		let {cutterBox, cutTop, cutLeft, imgTop, imgLeft, imgHeight, imgWidth, bottomMask, topMask, rightMask, leftMask, containerW, containerH, rotate} = this
		if (rotate % 2 !== 0) {
			imgLeft = (containerW - imgHeight) / 2
			imgTop = (containerH - imgWidth) / 2
			let tmp = imgWidth
			imgWidth = imgHeight
			imgHeight = tmp
		}
		if (cutWidth > imgWidth) cutWidth = imgWidth
		if (cutHeight > imgHeight) cutHeight = imgHeight
		if (cutLeft < imgLeft) cutLeft = imgLeft
		if (cutLeft + cutWidth > imgLeft + imgWidth) cutLeft = imgLeft + imgWidth - cutWidth
		if (cutTop < imgTop) cutTop = imgTop
		if (cutTop + cutHeight > imgTop + imgHeight) cutTop = imgTop + imgHeight - cutHeight
		let animateStyle = 'all 0.3s'
		let array = [cutterBox, bottomMask, topMask, rightMask, leftMask]
		array.forEach((el) => {
			el.style.transition = animateStyle
		})
		this.setMaskStyle(cutLeft, cutTop, cutWidth, cutHeight)
		setTimeout(() => {
			array.forEach((el) => {
				el.style.transition = ''
			})
		}, 300)
	}
	handleMouseDown(e) {
		this.startPos = {clientX: e.clientX, clientY: e.clientY}
	}
	resizeTop(cutHeight, cutTop, moveY) {
		let {mincutHeight} = this.config
		let newHeight = cutHeight - moveY
		let newTop = cutTop + moveY
		if (newHeight < mincutHeight) return
		if (newTop < 0) {
			newTop = 0
		}
		return {newTop, newHeight}
	}
	resizeBottom(cutHeight, cutTop, moveY) {
		let {containerH} = this
		let {mincutHeight} = this.config
		let newHeight = cutHeight + moveY
		if (newHeight < mincutHeight) return
		if (cutTop + newHeight > containerH) {
			newHeight = containerH - cutTop
		}
		return {newHeight}
	}
	/* 图片尺寸与裁剪不能小于裁剪区尺寸 */
	adjustToCut(imgWidth, imgHeight) {
		let {orgImgW, orgImgH} = this
		let {cutWidth, cutHeight} = this.config
		let imgRatio = orgImgW / orgImgH
		let cutRatio = cutWidth / cutHeight
		if (imgHeight < cutHeight) {
			this.config.canReduce = false
			if (imgWidth < cutWidth) {
				if (imgRatio > cutRatio) {
					imgHeight = cutHeight
					imgWidth = imgHeight * imgRatio
				} else {
					imgWidth = cutWidth
					imgHeight = imgWidth / imgRatio
				}
			} else {
				imgHeight = cutHeight
				imgWidth = imgHeight * imgRatio
			}
		} else {
			if (imgWidth < cutWidth) {
				this.config.canReduce = false
				imgWidth = cutWidth
				imgHeight = imgWidth / imgRatio
			}
		}
		return {imgWidth, imgHeight}
	}
}
