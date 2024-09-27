(function() {
    var notifications = [];
    console.log("脚本开始执行");
    console.log("请求 URL: " + $request.url);
    console.log("响应状态码: " + $response.status);
    console.log("响应头: " + JSON.stringify($response.headers));

    try {
        var responseBody = JSON.parse($response.body);
        var mallName = responseBody?.mall_entrance?.mall_data?.mall_name;

        if (mallName) {
            console.log("Mall Name: " + mallName);
            checkBlacklist(mallName, responseBody);
        } else {
            console.log("未能找到 mall_name 字段。");
            notifications.push("未能找到 mall_name 字段。");
            sendFinalNotification("错误", mallName + "白名单店铺", notifications.join("; "));
            $done({});
        }
    } catch (error) {
        console.log("脚本执行错误: " + error);
        notifications.push("脚本执行错误: " + error);
        sendFinalNotification("错误", "脚本执行错误", notifications.join("; "));
        $done({});
    } 

    function checkBlacklist(mallName, responseBody) {
        var storedMallName = $persistentStore.read("blackmailMallName");
        var mallBool = "白";

        if (!storedMallName) {
            console.log("黑名单数据为空，开始获取黑名单数据...");
            $httpClient.get("https://sql.zeroapi.dns.army/get_blackmail?auth=z777999", function(error, response, data) {
                if (error) {
                    console.log("获取黑名单数据时出错: " + error);
                    notifications.push("获取黑名单数据失败: " + error);
                    sendFinalNotification("错误", mallName + "白名单店铺", notifications.join("; "));
                    return;
                }

                $persistentStore.write(data, "blackmailMallName");
                notifications.push("已从服务器获取新的黑名单数据。");
            });
        } else if (storedMallName.includes(mallName)) {
            notifications.push("黑名单店铺。");
            mallBool = "黑";
        } else {
            notifications.push("正常店铺。");
            analyzeProductData(responseBody, mallBool, mallName);
        }
    }

    function analyzeProductData(responseBody, mallBool, mallName) {
        const maxPrice = 0.81;
        var lowestPrice = Infinity;
        var lowestPriceSkuInfo;

        try {
            if (responseBody.goods?.is_pre_sale) {
                notifications.push("预售：已跳过");
                return;
            }

            var group_id = responseBody.goods?.group?.[0]?.group_id;
            var detail_id = responseBody.activity_collection?.activity?.detail_id;
            var mall_id = responseBody.goods?.mall_id;
            var goods_name = responseBody.goods?.goods_name;
            var pdd_route = responseBody.mall_entrance?.mall_data?.pdd_route;
            var activity_id = responseBody.activity_collection?.activity?.activity_id;

            var skuJson = responseBody.sku;
            if (skuJson) {
                skuJson.forEach((sku) => {
                    var price_original = parseFloat(sku.normal_price) / 100;
                    var group_price = parseFloat(sku.group_price) / 100;

                    var selectedPrice = Math.min(price_original, group_price);
                    
                    if (selectedPrice > 0.05 && selectedPrice <= maxPrice) {
                        if (selectedPrice < lowestPrice) {
                            lowestPrice = selectedPrice;
                            lowestPriceSkuInfo = {
                                sku_id: sku.sku_id,
                                goods_id: sku.goods_id               
                            };
                        }
                    }
                });

                if (lowestPriceSkuInfo) {
                    uploadProductInfo(
                        "product_info", 
                        goods_name, 
                        mallName, 
                        lowestPrice, 
                        lowestPriceSkuInfo.goods_id, 
                        group_id, 
                        lowestPriceSkuInfo.sku_id, 
                        detail_id, 
                        mall_id, 
                        pdd_route, 
                        activity_id, 
                        mallBool
                    );
                } else {
                    notifications.push("价格过高或无效, 未上传数据。");
                }
            } else {
                notifications.push("SKU解析失败");
            }
        } catch (error) {
            console.log("商品数据解析错误: " + error);
            notifications.push("商品数据解析错误: " + error);
        }
    }

    function uploadProductInfo(tableName, goods_name, mallName, price, goods_id, group_id, sku_id, detail_id, mall_id, pdd_route, activity_id, mallBool) {
        mallBool = (mallBool === "黑") ? "假" : "真";
        var shopBool = encodeURIComponent("真");
        
        var url = `http://207.46.141.108:13312/upload.php?auth=z777999&table_name=${encodeURIComponent(tableName)}&good_name=${encodeURIComponent(goods_name)}&mallName=${encodeURIComponent(mallName)}&price_int=${price}&good_id=${goods_id}&group_Id=${group_id}&sku_Id=${sku_id}&detailId=${detail_id}&mall_id=${mall_id}&mall_bool=${encodeURIComponent(mallBool)}&shop_bool=${shopBool}&mall_url=${encodeURIComponent(pdd_route)}&activity_id=${activity_id}`; 

        console.log("构建的请求URL: " + url);

        if (!url.startsWith("http")) {
            console.log("无效的URL: " + url);
            return;
        }

        $httpClient.get(url, function(error, response, data) {
            if (error) {
                console.log("上传商品信息时出错: " + error);
                notifications.push("上传商品信息失败: " + error);
                sendFinalNotification("错误", mallName + "黑名单店铺", notifications.join("; "));
            } else {
                console.log("商品信息上传成功: " + data);
                notifications.push("商品信息上传成功: " + data);
                sendFinalNotification("成功", mallName + "白名单店铺", notifications.join("; "));
            }
        });
    }

    function sendFinalNotification(type, title, content) {
        $notification.post(type, title, content);
    }
})();
