<?php
namespace Ephp\NodeBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Sensio\Bundle\FrameworkExtraBundle\Configuration\Template;

/**
 * @Route("/online")
 */
class OnLineController extends Controller {

    /**
     * @Route("/all", name="online_all")
     * @Template()
     */
    public function allUserAction() {
        $em = $this->getEm();
        $_user = $em->getRepository($this->container->getParameter('ephp_acl.user.class'));
//        $users = $_user->findAll();
        $users = $_user->findBy(array(), array('lastLogin' => 'DESC'), 10);
        return array(
            'users' => $users,
        );
    }

    /**
     *
     * @return \Doctrine\ORM\EntityManager
     */
    private function getEm() {
        return $this->getDoctrine()->getEntityManager();
    }

}
