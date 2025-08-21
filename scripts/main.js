// Константы
const drillTypes = [
    Blocks.mechanicalDrill,
    Blocks.pneumaticDrill,
    Blocks.laserDrill,
    Blocks.blastDrill,
    Blocks.eruptionDrill,
    Blocks.impactDrill,
];
const exceptionResults = [Blocks.separator, Blocks.disassembler];
const exceptionMultipliers = [Blocks.siliconCrucible, Blocks.cultivator];
const waterExtractor = Blocks.waterExtractor;
const oilExtractor = Blocks.oilExtractor;
const oil = Liquids.oil;

// Клавиши
const keyDrillSpeed = KeyCode.c;
const keyPressed = KeyCode.controlLeft;

// Основная таблица
const mainTable = new Table();

// Состояния
var worldLoaded = false;
var dragging = false;
var startX = 0, startY = 0, endX = 0, endY = 0;
// var prevEndX = -1, prevEndY = -1; // Для оптимизации памяти
var regions = []; // Массив для хранения всех областей

// Основные ивенты
Events.on(WorldLoadEvent, init);
Events.run(Trigger.draw, drawer);
Events.run(Trigger.update, update);


function updateStatistics() {
    mainTable.clearChildren();
    
    if (regions.length === 0) {
        mainTable.add("[lightgray]" + Core.bundle.get("rateCalculate.select") + "[]").left().row();
        mainTable.add("[lightgray]" + Core.bundle.get("rateCalculate.selectfew") + "[]").left();
        return;
    }
    
    // Суммарная статистика по всем областям
    var totalDrillStats = {speed: 0, effTotal: 0, amount: 0};
    var totalInOutPutStats = {input: new ObjectMap(), output: new ObjectMap(), exceptions: new ObjectMap(), effTotal: 0, amount: 0};
    var totalPowerStats = {production: 0, effTotal: 0, amount: 0}
    
    // TODO убрать повторы зданий по ID
    // TODO оптимизировать сбор зданий в одной функции
    // Собираем данные со всех областей
    for (let region of regions) {
        var drillStats = getDrillStatsForRegion(region);
        var inOutPutStats = getInOutPutStatsForRegion(region);
        var powerStats = getPowerStatsForRegion(region);

        // Суммируем буры
        totalDrillStats.speed += drillStats.speed;
        totalDrillStats.effTotal += drillStats.effTotal;
        totalDrillStats.amount += drillStats.amount;
        
        // Суммируем Input и Output
        inOutPutStats.input.each((item, amount) => {
            totalInOutPutStats.input.put(item, totalInOutPutStats.input.get(item, 0) + amount);
        });
        inOutPutStats.output.each((item, amount) => {
            totalInOutPutStats.output.put(item, totalInOutPutStats.output.get(item, 0) + amount);
        });
        inOutPutStats.exceptions.each((item, amount) => {
            totalInOutPutStats.exceptions.put(item, totalInOutPutStats.exceptions.get(item, 0) + amount);
        });
        totalInOutPutStats.effTotal += inOutPutStats.effTotal;
        totalInOutPutStats.amount += inOutPutStats.amount;
        
        // Суммируем энергию
        totalPowerStats.production = powerStats.production;
        totalPowerStats.effTotal = powerStats.effTotal;
        totalPowerStats.amount = powerStats.amount;
    };
    
    // Статистика буров
    if (totalDrillStats.amount > 0) {
        const drillTable = new Table();
        drillTable.add("[accent]" + Core.bundle.get("rateCalculate.drills") + ":[]").row();
        drillTable.add(Core.bundle.get("rateCalculate.speed") + " : ").left();
        drillTable.add(Math.round(totalDrillStats.speed * 100) / 100 + "/" + Core.bundle.get("rateCalculate.sec")).left().row();
        drillTable.add(Core.bundle.get("rateCalculate.efficiency") + ": ").left();
        drillTable.add(Math.round(totalDrillStats.effTotal / totalDrillStats.amount * 1000) / 10 + "%").left().row();
        mainTable.add(drillTable).row();
    }
    
    // Статистика энергии
    if (totalPowerStats.amount > 0) {
        mainTable.row();
        const powerTable = new Table();
        powerTable.add("[accent]" + Core.bundle.get("rateCalculate.energy") + ":[]").row();
        powerTable.add(Core.bundle.get("rateCalculate.production") + ": ").left();
        powerTable.add(Math.round(totalPowerStats.production * 100) / 100 + "/" + Core.bundle.get("rateCalculate.sec")).left().row();
        powerTable.add(Core.bundle.get("rateCalculate.efficiency") + ": ").left();
        powerTable.add(Math.round(totalPowerStats.effTotal / totalPowerStats.amount * 1000) / 10 + "%").left().row();
        mainTable.add(powerTable).row();
    }
    
    // Статистика фабрик (вход)
    let totalFactoriesInput = totalInOutPutStats.input;
    if (totalFactoriesInput.size > 0) {
        mainTable.row();
        mainTable.add("[accent]" + Core.bundle.get("rateCalculate.input") + ":[]").row();
        
        totalFactoriesInput.each((item, amount) => {
            const rowTable = new Table();
            rowTable.add(new Image(item.uiIcon)).size(24);
            rowTable.add(item + ": ").left();
            rowTable.add(Math.round(amount * 100) / 100 + "/" + Core.bundle.get("rateCalculate.sec")).left();
            mainTable.add(rowTable).left().row();
        });
    }
    
    // Статистика фабрик (выход)
    let totalFactoriesOutput = totalInOutPutStats.output;
    if (totalFactoriesOutput.size > 0 || totalInOutPutStats.exceptions.size > 0) {
        mainTable.row();
        mainTable.add("[accent]" + Core.bundle.get("rateCalculate.output") + ":[]").row();

        totalFactoriesOutput.each((item, amount) => {
            const rowTable = new Table();
            let result = 0;
            let amountString = "";
            if (totalInOutPutStats.exceptions.containsKey(item)) {
                amountString = "~";
                result += totalInOutPutStats.exceptions.get(item);
                totalInOutPutStats.exceptions.remove(item);
            }
            rowTable.add(new Image(item.uiIcon)).size(24);
            rowTable.add(item + ": ").left();
            amountString += Math.round((amount + result) * 100) / 100 + "/" + Core.bundle.get("rateCalculate.sec");
            rowTable.add(amountString).left();
            mainTable.add(rowTable).left().row();
        });

        totalInOutPutStats.exceptions.each((item, amount) => {
            const rowTable = new Table();
            rowTable.add(new Image(item.uiIcon)).size(24);
            rowTable.add(item + ": ").left();
            rowTable.add("~" + Math.round(amount * 100) / 100 + "/" + Core.bundle.get("rateCalculate.sec")).left();
            mainTable.add(rowTable).left().row();
        });
    }

    // Общая эффективность фабрик
    if (totalFactoriesInput.size > 0 || totalFactoriesOutput.size > 0) {
        mainTable.row();
        mainTable.add("[accent]" + Core.bundle.get("rateCalculate.overall") + ": []");
        mainTable.add(Math.round(totalInOutPutStats.effTotal / totalInOutPutStats.amount * 1000) / 10 + "%").left().row();
    }
}

//
// Функции для работы с отдельными областями
//

function getDrillStatsForRegion(region) {
    let minx = Math.min(region.startX, region.endX);
    let miny = Math.min(region.startY, region.endY);
    let maxx = Math.max(region.startX, region.endX);
    let maxy = Math.max(region.startY, region.endY);

    let speed = 0;
    let amount = 0;
    let effTotal = 0;
    let IDs = [];
    
    for(let x = minx; x <= maxx; x++){
        for(let y = miny; y <= maxy; y++){
            let build = Vars.world.build(x, y);
            if(build == null || build.block == null) continue;
            
            if(drillTypes.includes(build.block)){
                if (IDs.includes(build.id)) continue;
                IDs.push(build.id);
                
                speed += getDrillRate(build, build.block);
                amount++;
                effTotal += build.efficiency;
            }
        }
    }
    return {speed: speed, effTotal: effTotal, amount: amount};
}

function getDrillRate(build, block) {
    let drillingItem = build.dominantItem;
    let drillingItems = build.dominantItems;
    let baseDrillTime = block.getDrillTime(drillingItem);

    let liquidBoost = 1;
    // let groundMultiplier = 1;

    // Жидкостной буст
    if(block.hasLiquids && build.liquids.currentAmount() >= 0.001) {
        liquidBoost *= block.liquidBoostIntensity * block.liquidBoostIntensity;
    }

    // // Бонус от типа земли (для новых буров)
    // if (drill.block.attributes && drill.block.attributes.containsKey(Attribute.heat)) {
    //     groundMultiplier = tile.getAttributes().get(Attribute.heat) * drill.block.attributes.get(Attribute.heat) + 1;
    // }

    return (60 / baseDrillTime * liquidBoost * build.timeScale() * drillingItems);
}

function getInOutPutStatsForRegion(region) {
    let minx = Math.min(region.startX, region.endX);
    let miny = Math.min(region.startY, region.endY);
    let maxx = Math.max(region.startX, region.endX);
    let maxy = Math.max(region.startY, region.endY);

    let input = new ObjectMap();
    let output = new ObjectMap();
    let exceptions = new ObjectMap();
    let IDs = [];

    let amount = 0;
    let effTotal = 0;

    for(let x = minx; x <= maxx; x++){
        for(let y = miny; y <= maxy; y++){
            let build = Vars.world.build(x, y);
            if (!build || !build.block) continue;
            let block = build.block;

            if (block == waterExtractor) {
                if (IDs.includes(build.id)) continue;

                IDs.push(build.id);
                amount++;
                effTotal += build.efficiency;

                let exceptionMultiplier = 1 + build.boost;

                let liquidDrop = build.liquidDrop;
                output.put(liquidDrop, block.pumpAmount * 60 * build.timeScale() * exceptionMultiplier + output.get(liquidDrop, 0));
            }
            if (block == oilExtractor) {
                if (IDs.includes(build.id)) continue;

                IDs.push(build.id);
                amount++;
                effTotal += build.efficiency;

                let exceptionMultiplier = build.boost;

                if (block.consumers && block.consumers.length > 0) {
                    for (let consumer of block.consumers) {
                        if (consumer instanceof ConsumeItems) {
                            for (let item of consumer.items) {
                                input.put(item.item, block.itemUseTime / 60 * build.timeScale() * exceptionMultiplier + input.get(item.item, 0));
                            }
                        }
                        if (consumer instanceof ConsumeLiquid) {
                            input.put(consumer.liquid, consumer.amount * 60 * build.timeScale() * exceptionMultiplier + input.get(consumer.liquid, 0));
                        }
                    }
                }

                let liquidDrop = oil;
                output.put(liquidDrop, block.pumpAmount * 60 * build.timeScale() * exceptionMultiplier + output.get(liquidDrop, 0));
            } else if (block.pumpAmount) {
                if (IDs.includes(build.id)) continue;

                IDs.push(build.id);
                amount++;
                effTotal += build.efficiency;

                let liquidDrop = build.liquidDrop;
                let amountLiquids = 0;

                if (liquidDrop == null) continue;
                let tempTiles = new Seq();
                Vars.world.tile(build.tileX(), build.tileY()).getLinkedTiles(tempTiles).each(other => {
                    if (other.floor().liquidDrop == liquidDrop && other.floor().liquidMultiplier != null)
                        amountLiquids += other.floor().liquidMultiplier;
                });

                output.put(liquidDrop, amountLiquids * block.pumpAmount * 60 * build.timeScale() + output.get(liquidDrop, 0));
            }

            if (block.craftTime) {
                if (IDs.includes(build.id)) continue;

                IDs.push(build.id);
                amount++;
                effTotal += build.efficiency;

                let exceptionMultiplier = 1;
                if (exceptionMultipliers.includes(block))
                    exceptionMultiplier = build.efficiencyMultiplier();

                if (block.consumers && block.consumers.length > 0) {
                    for (let consumer of block.consumers) {
                        if (consumer instanceof ConsumeItems) {
                            for (let item of consumer.items) {
                                input.put(item.item, item.amount / block.craftTime * 60 * build.timeScale() * exceptionMultiplier + input.get(item.item, 0));
                            }
                        }
                        if (consumer instanceof ConsumeLiquid) {
                            input.put(consumer.liquid, consumer.amount * 60 * build.timeScale() * exceptionMultiplier + input.get(consumer.liquid, 0));
                        }
                    }
                }

                if (block.outputItem) {
                    output.put(block.outputItem.item, block.outputItem.amount / block.craftTime * 60 * build.timeScale() * exceptionMultiplier + output.get(block.outputItem.item, 0));
                }
                if (block.outputLiquid) {
                    output.put(block.outputLiquid.liquid, block.outputLiquid.amount * 60 * build.timeScale() * exceptionMultiplier + output.get(block.outputLiquid.liquid, 0));
                }

                if (exceptionResults.includes(block) && block.results != null) {
                    let totalAmount = 0;
                    for (let item of block.results) {
                        totalAmount += item.amount;
                    }

                    for (let item of block.results) {
                        exceptions.put(item.item, (item.amount / totalAmount) / block.craftTime * 60 * build.timeScale() + exceptions.get(item.item, 0));
                    }
                }
            }
        }
    }

    return {input: input, output: output, exceptions: exceptions, effTotal: effTotal, amount: amount};
}

function getPowerStatsForRegion(region) {
    let minx = Math.min(region.startX, region.endX);
    let miny = Math.min(region.startY, region.endY);
    let maxx = Math.max(region.startX, region.endX);
    let maxy = Math.max(region.startY, region.endY);

    let totalPower = 0;
    let amount = 0;
    let effTotal = 0;
    let IDs = []

    for(let x = minx; x <= maxx; x++){
        for(let y = miny; y <= maxy; y++){
            let build = Vars.world.build(x, y);
            if (!build || !build.block) continue;
            let block = build.block;

            if (!block.powerProduction) continue;

            if (IDs.includes(build.id)) continue;

            IDs.push(build.id);
            totalPower += getPowerProductionRate(build, block);
            amount++;
            effTotal += build.efficiency;
        }
    }

    return {production: totalPower, effTotal: effTotal, amount: amount};
}

function getPowerProductionRate(build, block) {
    let production = build.getPowerProduction() || block.powerProduction;
    
    let usagePower = block.consPower;
    if (usagePower != null) usagePower = usagePower.usage;
    else usagePower = 0;
    
    production = (production - usagePower) * 60 * build.timeScale();
    
    return production;
}

//
// Основные функции: Инициализация, Отрисовка рамки, Update - InputHandler
//

function init() {
    // Попытка удаления старой таблицы
    try {
        Vars.ui.hudGroup.removeChild(mainTable);
    } catch (error) {
        
    }

    mainTable.bottom().left().margin(10);
    Vars.ui.hudGroup.addChild(mainTable);
    worldLoaded = true; 
}

function drawer() {
    if (!worldLoaded) return;

    // Отрисовка текущей области (если есть)
    if (dragging) {
        let wx1 = Math.min(startX, endX) * Vars.tilesize;
        let wy1 = Math.min(startY, endY) * Vars.tilesize;
        let wx2 = (Math.max(startX, endX) + 1) * Vars.tilesize;
        let wy2 = (Math.max(startY, endY) + 1) * Vars.tilesize;

        Draw.z(Layer.overlayUI - 1);
        Lines.stroke(2, Pal.items);
        Lines.rect(wx1 - Vars.tilesize/2, wy1 - Vars.tilesize/2, wx2 - wx1, wy2 - wy1);
        Draw.color(Pal.items, 0.1);
        Fill.rect((wx1+wx2)/2 - Vars.tilesize/2, (wy1+wy2)/2 - Vars.tilesize/2, wx2-wx1, wy2-wy1);
        Draw.reset();
    }

    // Отрисовка всех сохраненных областей
    for (let region of regions) {
        let wx1 = Math.min(region.startX, region.endX) * Vars.tilesize;
        let wy1 = Math.min(region.startY, region.endY) * Vars.tilesize;
        let wx2 = (Math.max(region.startX, region.endX) + 1) * Vars.tilesize;
        let wy2 = (Math.max(region.startY, region.endY) + 1) * Vars.tilesize;

        Draw.z(Layer.overlayUI - 1);
        Lines.stroke(2, Pal.items);
        Lines.rect(wx1 - Vars.tilesize/2, wy1 - Vars.tilesize/2, wx2 - wx1, wy2 - wy1);
        Draw.color(Pal.items, 0.1);
        Fill.rect((wx1+wx2)/2 - Vars.tilesize/2, (wy1+wy2)/2 - Vars.tilesize/2, wx2-wx1, wy2-wy1);
        Draw.reset();
    };
}

//TODO: оптимизировать поток
function update() {
    if (!worldLoaded) return;

    const ctrlPressed = Core.input.keyDown(keyPressed);
    
    if (Core.input.keyTap(keyDrillSpeed)) {
        startX = World.toTile(Core.input.mouseWorldX());
        startY = World.toTile(Core.input.mouseWorldY());
        // endX = -1;
        // endY = -1;
        dragging = true;
    }
    
    if (dragging) {
        // prevEndX = endX;
        // prevEndY = endY;
        endX = World.toTile(Core.input.mouseWorldX());
        endY = World.toTile(Core.input.mouseWorldY());
        
        if (ctrlPressed) {
            if (!Core.input.keyDown(keyDrillSpeed)) {
                regions.push({
                    startX: startX,
                    startY: startY,
                    endX: endX,
                    endY: endY
                });
            }
        } else {
            regions[0] = {
                startX: startX,
                startY: startY,
                endX: endX,
                endY: endY
            }
        }

        if (!Core.input.keyDown(keyDrillSpeed)) {
            dragging = false;
        }
    }

    // if (prevEndX !== endX || prevEndY !== endY)
    //     updateStatistics();

    updateStatistics();

    if (!ctrlPressed) {
        regions = [];
    }
}
