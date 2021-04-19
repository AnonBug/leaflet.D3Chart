/*
 * @Author: zyc
 * @Description: file content
 * @Date: 2021-04-18 20:48:19
 * @LastEditTime: 2021-04-19 18:53:13
 */
(function (factory) {
    // 这里似乎是在根据环境判断如何引入
    if (typeof define === 'function' && define.amd) {
        // AMD
        define(['leaflet'], factory)
    } else if (typeof module !== 'undefined') {
        // Node/CommonJS
        module.exports = factory(require('leaflet'))
    } else {
        // Browser globals
        if (typeof window.L === 'undefined') {
            throw new Error('Leaflet must be loaded first')
        }
        factory(window.L)
    }
}(function (L) {
    /**
     * @description: 传入制图数据, 返回一个
     * @param {[]} dataset : 数据集: 包含 {x, y, data}
     * @param {{}} options : 一个参数对象, dataset 是必需的
     * @return {*}
     */
    L.D3Chart = function (dataset, {
        /* 
        函数默认参数的解构赋值 https://es6.ruanyifeng.com/#docs/function
        */
        scale = 1, // 缩放尺度
        type = 'pie', // 制图类型
        width_height = 1, // 容器宽高比例
    } = {}) {

        /* 根据数据情况, 为各区图表设置适当比例 */
        let bili = dataset.map(item => item.data.reduce((pre, next) => pre + next))
        let base = Math.pow(Math.min(...bili), 0.3) // 以最小值为基准进行放大
        bili = bili.map(item => Math.pow(item, 0.3) / base)

        let markers = [] // 存储生成的 marker 图层
        for (let i = 0; i < dataset.length; i++) {
            let {
                lat,
                lng,
                data
            } = dataset[i]

            // 使用 divIcon 向 leaflet 添加 div 容器, 后面需要依赖这个容器追加 svg 图表
            let className = `my-div-icon-${i}` // 自定义类
            let marker = L.marker([lat, lng], {
                icon: L.divIcon({
                    className
                })
            })
            markers.push(marker)

            // 当图层添加至地图时, 进行渲染(这是为了应对图层移除再添加后, svg 内容消失的问题)
            marker.on('add', () => {
                // svg 的宽高对比取决于数据的总和大小对比, 在这之外才是 scale 的缩放比例
                var w = 40 * width_height * scale * bili[i];
                var h = 40 / width_height * scale * bili[i];

                // 在自定义 div 中创建 svg 要素
                var svg = d3.select('.' + className)
                    .append("svg")
                    .attr("width", w)
                    .attr("height", h)
                    // 对 svg 宽高进行移动, 以使其中心点对准需要放置的位置
                    .attr('transform', `translate(${-w / 2}, ${-h / 2})`)
                    .style('overflow', 'visible')

                // 根据绘制类型, 渲染不同的图表形式
                switch (type) {
                    case 'ring': // 圆环
                        drawPie(svg, data, w, h, true)
                        break;
                    case 'bar': // 柱状图
                        drawBar(svg, data, w, h)
                        break;
                    default: // 默认为实心圆
                        drawPie(svg, data, w, h)
                        break;
                }
            })
        }
        return L.featureGroup(markers)
    }

    /**
     * @description: 绘制饼状图, 可为环
     * @param {*} svg svg 容器
     * @param {*} dataset 数据集
     * @param {*} w 容器宽度
     * @param {*} h 容器高度
     * @param {Boolean} isRing 是否绘制环
     * @return {*} 无返回值, 直接添加
     */
    const drawPie = (svg, dataset, w, h, isRing) => {

        const outerRadius = w / 2 // 饼图半径
        const innerRadius = isRing ? w / 4 : 0 // 内环半径(绘制 pie 时设置 0)
        // d3 方法
        const arc = d3.arc()
            .innerRadius(innerRadius)
            .outerRadius(outerRadius);
        const pie = d3.pie()

        // Easy colors accessible via a 10-step ordinal scale
        const color = d3.scaleOrdinal(d3.schemeCategory10);

        // 设置arc
        const arcs = svg.selectAll("g.arc")
            .data(pie(dataset))
            .enter()
            .append("g")
            .attr("class", "arc")
            // 通过 transform ,省得定义 起始点
            .attr("transform", "translate(" + outerRadius + "," + outerRadius + ")");

        // 绘制路径
        arcs.append("path")
            .attr("fill", (d, i) => color(i))
            .transition()
            .attr("d", arc)

        // 添加注记
        arcs.append("text")
            .attr("transform", d => `translate(${arc.centroid(d)})`)
            .attr('font-size', '11px')
            .attr('fill', 'white')
            .attr("text-anchor", "middle")
            .text(d => d.value)
    }

    /**
     * @description: 绘制柱形图
     * @param {*} svg svg 容器
     * @param {*} dataset 数据集
     * @param {*} w 容器宽度
     * @param {*} h 容器高度
     * @return {*} 无返回值, 直接添加
     */
    const drawBar = (svg, dataset, w, h) => {
        const color = d3.scaleOrdinal(d3.schemeCategory10);

        const padding = 20
        // 比例尺
        const xScale = d3.scaleBand()
            .domain(d3.range(dataset.length))
            .rangeRound([0, w])
            .paddingInner(0.1)

        // 比例尺
        const yScale = d3.scaleLinear()
            .domain([0, d3.max(dataset)])
            .range([padding, h - padding])

        // 设置arc
        const bars = svg.selectAll("g.bar")
            .data(dataset)
            .enter()
            .append("g")
            .attr("class", "bar")

        bars.append('rect')
            .attr('x', (d, i) => xScale(i)) // x 定位
            .attr('y', d => h - yScale(d)) // y 定位
            .attr('width', xScale.bandwidth()) // 宽度
            .attr('fill', (d, i) => color(i)) // 色彩
            .transition()
            .attr('height', d => yScale(d)) // 高度

        // 添加注记
        bars.append("text")
            .attr('x', (d, i) => xScale.bandwidth() / 2)
            .attr('y', d => 14)
            .attr("transform", (d, i) => `translate(${xScale(i)}, ${h - yScale(d)})`)
            .text(d => d)
            .attr('font-size', '11px')
            .attr('fill', 'white')
            .attr("text-anchor", "middle")
    }
}))