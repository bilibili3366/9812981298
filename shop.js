(function() {
    var notifications = [];
    console.log("脚本开始执行");
    console.log("请求 URL: " + $request.url);
    console.log("响应状态码: " + $response.status);
    console.log("响应头: " + JSON.stringify($response.headers));

    try {
        var responseBody = JSON.parse($response.body);
        var mallName = responseBody?.mall_entrance?.mall_data?.mall_name;

        console.log("解析到的商店名称：" + mallName);

        if (mallName) {
            console.log("开始检查黑名单");
            checkBlacklist(mallName, responseBody);
        } else {
            console.log("未能找到 mall_name 字段。");
            notifications.push("未能找到 mall_name 字段。");
            sendFinalNotification("错误", "未找到店铺名称", notifications.join("; "));
            $$done({});
        }
    } catch (error) {
        console.log("解析响应体或脚本执行错误: " + error);
        notifications.push("解析响应体或脚本执行错误: " + error);
        sendFinalNotification("错误", "脚本执行错误", notifications.join("; "));
        $done({});
    }

    function checkBlacklist(mallName, responseBody) {
        var storedMallName = $persistentStore.read("blackmailMallName");
        var isBlacklisted = false;
        if (!storedMallName) {
            console.log("黑名单数据为空，开始从服务器获取黑名单数据...");
            $httpClient.get("https://example.com/get_blackmail", function(error, response, data) {
                if (error) {
                    console.log("获取黑名单数据时出错: " + error);
                    notifications.push("获取黑名单数据失败: " + error);
                    sendFinalNotification("错误", mallName + " - 获取黑名单失败", notifications.join("; "));
                    $$done({});
                    return;
                }
                $persistentStore.write(data, "blackmailMallName");
                console.log("已从服务器获取新的黑名单数据。");
                isBlacklisted = data.includes(mallName);
                processResponseBody(responseBody, isBlacklisted, mallName);
            });
        } else {
            console.log("读取到的黑名单数据，正在进行校验...");
            isBlacklisted = storedMallName.includes(mallName);
            notifications.push(isBlacklisted ? "黑名单店铺。" : "正常店铺。");
            processResponseBody(responseBody, isBlacklisted, mallName);
        }
    }

    function processResponseBody(responseBody, isBlacklisted, mallName) {
        if (isBlacklisted) {
            console.log("该商店在黑名单中，不处理数据。");
            notifications.push("该商店在黑名单中。");
            sendFinalNotification("通知", mallName + " - 黑名单店铺", notifications.join("; "));
            $$done({});
        } else {
            console.log("该商店不在黑名单中，继续处理数据。");
            analyzeProductData(responseBody, isBlacklisted, mallName);
        }
    }

    function analyzeProductData(responseBody, isBlacklisted, mallName) {
        const maxPrice = 0.81;
        var lowestPrice = Infinity;
        var lowestPriceSkuInfo;
        console.log("商品价格分析中...");
        var skuJson = responseBody?.sku;
        if (skuJson) {
            skuJson.forEach((sku) => {
                var priceOriginal = parseFloat(sku.normal_price) / 100;
                var selectedPrice = Math.min(priceOriginal, sku.group_price ? parseFloat(sku.group_price) / 100 : priceOriginal);
                if (selectedPrice <= maxPrice) {
                    if (selectedPrice < lowestPrice) {
                        lowestPrice = selectedPrice;
                        lowestPriceSkuInfo = {
                            sku_id: sku.sku_id,
                            goods_id: sku.goods_id               
                        };
                    }
                }
            });
            if (lowestPrice !== Infinity) {
                uploadProductInfo("product_info", responseBody.goods.goods_name, mallName, lowestPrice, lowestPriceSkuInfo.sku_id, responseBody.goods.group_id, isBlacklisted);
                notifications.push("价格符合，数据已上传。");
                sendFinalNotification("成功", mallName + " - 正常店铺", notifications.join("; "));
            } else {
                console.log("未找到合适的商品价格。");
                notifications.push("未找到合适的商品价格。");
                sendFinalNotification("错误", "价格分析错误", notifications.join("; "));
            }
        } else {
            console.log("商品数据未包含SKU信息。");
            notifications.push("商品数据未包含SKU信息。");
            sendFinalNotification("错误", "数据解析错误", notifications.join("; "));
        }
        $$done({});
    }

    function uploadProductInfo(tableName, goods_name, mallName, price, sku_id, group_id, isBlacklisted) {
        console.log("准备上传商品信息...");
        var url = `http://207.46.141.108:13312/upload.php?auth=z777999&table_name=${encodeURIComponent(tableName)}&good_name=${encodeURIComponent(goods_name)}&mallName=${encodeURIComponent(mallName)}&price_int=${price}&good_id=${goods_id}&group_Id=${group_id}&sku_Id=${sku_id}&detailId=${detail_id}&mall_id=${mall_id}&mall_bool=${isBlacklisted}&shop_bool=${shopBool}&mall_url=${encodeURIComponent(pdd_route)}&activity_id=${activity_id}`; 
        console.log("上传URL: " + url);
        $httpClient.get(url, function(error, response, data) {
            if (error) {
                console.log("上传商品信息时出错: " + error);
                sendFinalNotification("错误", mallName + " - 上传失败", "错误详情: " + error);
            } else {
                console.log("商品信息上传成功: " + data);
                sendFinalNotification("成功", mallName + " - 上传成功", "响应数据: " + data);
            }
        });
    }

    function sendFinalNotification(type, title, content) {
        console.log("发送最终通知：" + title);
        if ($notification) {
            $notification.post(type, title, content);
        }
    }
})();
