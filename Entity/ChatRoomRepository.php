<?php

namespace Ephp\NodeBundle\Entity;

use Doctrine\ORM\EntityRepository;

/**
 * ChatRoomRepository
 *
 * This class was generated by the Doctrine ORM. Add your own custom
 * repository methods below.
 */
class ChatRoomRepository extends EntityRepository {

    public function aggiornaNickname($old, $new) {
        $db = $this->_em->getConnection();
        $query = "UPDATE chat_room c SET c.users = REPLACE(c.users, 's:" . strlen($old) . ":\"" . str_replace("'", "\'", $old) . "\"', 's:" . strlen($new) . ":\"" . str_replace("'", "\'", $new) . "\"'), c.alias = REPLACE(c.alias, 's:" . strlen($old) . ":\"" . str_replace("'", "\'", $old) . "\"', 's:" . strlen($new) . ":\"" . str_replace("'", "\'", $new) . "\"') WHERE c.users LIKE '%s:" . strlen($old) . ":\"" . str_replace("'", "\'", $old) . "\"%'";
        $stmt = $db->prepare($query);
        $params = array();
        $stmt->execute($params);
    }

}
