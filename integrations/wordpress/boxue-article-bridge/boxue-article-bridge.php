<?php
/**
 * Plugin Name: 博学文章接口桥接
 * Description: 为已发布文章的 REST 响应补充微信原始链接与文章编号，供博学准确匹配网站文章。
 * Version: 1.0.0
 * Author: ASSCUBO
 */
if ( ! defined( 'ABSPATH' ) ) { exit; }
add_action( 'rest_api_init', function () {
    register_rest_field( 'post', 'boxue_source', [
        'get_callback' => function ( $object ) {
            $id = isset( $object['id'] ) ? (int) $object['id'] : 0;
            if ( ! $id || get_post_status( $id ) !== 'publish' || get_post_field( 'post_password', $id ) !== '' ) { return null; }
            $url = (string) get_post_meta( $id, '_wxsync_wx_url', true );
            $parts = wp_parse_url( $url );
            if ( ! is_array( $parts ) || ! isset( $parts['host'], $parts['scheme'] ) || strtolower( $parts['host'] ) !== 'mp.weixin.qq.com' || ! in_array( strtolower( $parts['scheme'] ), [ 'http', 'https' ], true ) ) { return null; }
            return [ 'wechat_url' => esc_url_raw( $url ), 'article_key' => (string) get_post_meta( $id, '_wxsync_article_key', true ) ];
        },
        'schema' => [
            'type' => [ 'object', 'null' ], 'readonly' => true, 'context' => [ 'view', 'embed' ],
            'properties' => [ 'wechat_url' => [ 'type' => 'string' ], 'article_key' => [ 'type' => 'string' ] ],
        ],
    ] );
} );
